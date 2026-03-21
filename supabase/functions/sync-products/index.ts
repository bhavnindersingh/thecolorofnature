import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────────

const ODOO_URL = Deno.env.get("ODOO_URL")!;
const ODOO_DB = Deno.env.get("ODOO_DB")!;
const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME")!;
const ODOO_API_KEY = Deno.env.get("ODOO_API_KEY")!;
const ODOO_WEB_WAREHOUSE_ID = parseInt(Deno.env.get("ODOO_WEB_WAREHOUSE_ID") || "6");
const ODOO_WEB_LOCATION_ID = parseInt(Deno.env.get("ODOO_WEB_LOCATION_ID") || "74");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── JSON-RPC Helpers ─────────────────────────────────────────────────────────

let _rpcId = 1;

async function jsonrpc(service: string, method: string, args: unknown[]): Promise<unknown> {
    const resp = await fetch(`${ODOO_URL}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: _rpcId++, params: { service, method, args } }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(`Odoo Fault: ${JSON.stringify(json.error.data?.message ?? json.error)}`);
    return json.result;
}

// ─── Odoo Helpers ────────────────────────────────────────────────────────────

async function getOdooUid(): Promise<number> {
    const uid = await jsonrpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
    if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
    return uid;
}

async function odooExecute(uid: number, model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<unknown> {
    return jsonrpc("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs ?? {}]);
}

// ─── Sync Logic ──────────────────────────────────────────────────────────────

interface OdooTemplate {
    id: number;
    name: string;
    description_sale: string | false;
    list_price: number;
    categ_id: [number, string] | false;
    image_1920: string | false;
    product_variant_ids: number[];
    product_variant_count: number;
    active: boolean;
}

interface OdooVariant {
    id: number;
    product_tmpl_id: [number, string];
    name: string;
    default_code: string | false;
    lst_price: number;
    active: boolean;
    product_template_attribute_value_ids: number[];
}

interface OdooStockQuant {
    product_id: [number, string];
    quantity: number;
}

const BATCH_SIZE = 50;

async function syncProducts(skipImages = false) {
    const uid = await getOdooUid();
    const log: string[] = [];
    log.push(`Authenticated as UID: ${uid}`);

    // ── Resolve "Online Shop" tag ID ──
    const tagRecords = await odooExecute(uid, "product.tag", "search_read",
        [[["name", "=", "Online Shop"]]], { fields: ["id"], limit: 1 }
    ) as Array<{ id: number }>;
    const tagId = tagRecords[0]?.id ?? null;
    const domain: unknown[] = tagId
        ? [["sale_ok", "=", true], ["active", "=", true], ["product_tag_ids", "in", [tagId]]]
        : [["sale_ok", "=", true], ["active", "=", true]];
    log.push(tagId
        ? `Filtering by "Online Shop" tag (ID: ${tagId})`
        : `No "Online Shop" tag found — syncing all saleable products`
    );

    // ── Step 1: Fetch all matching product templates in batches ──
    const allTemplates: OdooTemplate[] = [];
    const templateFields = ["name", "description_sale", "list_price", "categ_id", "product_variant_ids", "product_variant_count", "active"];
    let offset = 0;
    while (true) {
        const batch = await odooExecute(uid, "product.template", "search_read", [domain], {
            fields: templateFields,
            offset,
            limit: BATCH_SIZE,
        }) as OdooTemplate[];
        allTemplates.push(...batch);
        log.push(`  Fetched templates ${offset + 1}-${offset + batch.length}`);
        if (batch.length < BATCH_SIZE) break;
        offset += batch.length;
    }
    log.push(`Found ${allTemplates.length} templates`);

    // ── Step 2: Collect all variant IDs and fetch them ──
    const allVariantIds = allTemplates.flatMap((t) => t.product_variant_ids);
    log.push(`Fetching ${allVariantIds.length} variants...`);

    const allVariants: OdooVariant[] = [];
    for (let offset = 0; offset < allVariantIds.length; offset += BATCH_SIZE) {
        const batchIds = allVariantIds.slice(offset, offset + BATCH_SIZE);
        const batch = await odooExecute(uid, "product.product", "search_read", [
            [["id", "in", batchIds]],
        ], {
            fields: ["product_tmpl_id", "name", "default_code", "lst_price", "active", "product_template_attribute_value_ids"],
        }) as OdooVariant[];
        allVariants.push(...batch);
    }
    log.push(`  Fetched ${allVariants.length} variants`);

    // ── Step 3: Fetch stock quantities at WHWE warehouse ──
    log.push(`Fetching stock at WHWE (location_id: ${ODOO_WEB_LOCATION_ID})...`);
    const stockQuants = await odooExecute(uid, "stock.quant", "search_read", [
        [["location_id", "=", ODOO_WEB_LOCATION_ID], ["quantity", ">", 0]],
    ], {
        fields: ["product_id", "quantity"],
    }) as OdooStockQuant[];

    // Build stock map: product.product ID → quantity
    const stockMap = new Map<number, number>();
    for (const sq of stockQuants) {
        const prodId = sq.product_id[0];
        stockMap.set(prodId, (stockMap.get(prodId) || 0) + sq.quantity);
    }
    log.push(`  ${stockMap.size} products with stock at WHWE`);

    // ── Step 4: Build variant lookup by template ──
    const variantsByTemplate = new Map<number, OdooVariant[]>();
    for (const v of allVariants) {
        const tmplId = v.product_tmpl_id[0];
        if (!variantsByTemplate.has(tmplId)) variantsByTemplate.set(tmplId, []);
        variantsByTemplate.get(tmplId)!.push(v);
    }

    // ── Step 5: Upsert products into Supabase ──
    log.push(`Upserting products into Supabase...`);
    let productsUpserted = 0;
    let variantsUpserted = 0;
    let imagesUpserted = 0;

    for (let i = 0; i < allTemplates.length; i += BATCH_SIZE) {
        const batch = allTemplates.slice(i, i + BATCH_SIZE);

        // Upsert product templates
        const productRows = batch.map((t) => {
            const variants = variantsByTemplate.get(t.id) || [];
            const hasStock = variants.some((v) => (stockMap.get(v.id) || 0) > 0);
            const categoryName = t.categ_id ? (t.categ_id as [number, string])[1] : null;
            // Extract the leaf category name (e.g., "All / Saleable / Bag" → "Bag")
            const leafCategory = categoryName?.split(" / ").pop() || categoryName;

            const imageUrl = `/odoo-image/product.template/${t.id}/image_1920`;

            return {
                odoo_product_id: t.id,
                name: t.name,
                description: t.description_sale || null,
                price: t.list_price,
                category: leafCategory,
                in_stock: hasStock,
                image_url: imageUrl,
                updated_at: new Date().toISOString(),
            };
        });

        const { error: prodError } = await supabase
            .from("products")
            .upsert(productRows, { onConflict: "odoo_product_id" });

        if (prodError) {
            log.push(`  ERROR upserting products batch ${i}: ${prodError.message}`);
            continue;
        }
        productsUpserted += batch.length;

        // Now fetch the Supabase IDs for these products (needed for variants FK)
        const odooIds = batch.map((t) => t.id);
        const { data: supaProducts } = await supabase
            .from("products")
            .select("id, odoo_product_id")
            .in("odoo_product_id", odooIds);

        const supaProductMap = new Map<number, number>();
        for (const sp of supaProducts || []) {
            supaProductMap.set(sp.odoo_product_id, sp.id);
        }

        // Upsert variants for each product in this batch
        const variantRows: Array<Record<string, unknown>> = [];
        for (const t of batch) {
            const supaProductId = supaProductMap.get(t.id);
            if (!supaProductId) continue;

            const variants = variantsByTemplate.get(t.id) || [];
            for (const v of variants) {
                variantRows.push({
                    product_id: supaProductId,
                    odoo_variant_id: v.id,
                    sku: v.default_code || null,
                    stock_quantity: stockMap.get(v.id) || 0,
                    // Size is typically encoded in the SKU after the last /
                    // e.g., DRE-ALI-WH_BL-SHI-COT/L → "L"
                    size: v.default_code ? extractSizeFromSku(v.default_code) : null,
                });
            }
        }

        if (variantRows.length > 0) {
            const { error: varError } = await supabase
                .from("product_variants")
                .upsert(variantRows, { onConflict: "odoo_variant_id" });

            if (varError) {
                log.push(`  ERROR upserting variants batch ${i}: ${varError.message}`);
            } else {
                variantsUpserted += variantRows.length;
            }
        }

        // Upsert product_images using direct Odoo image URLs (no download needed)
        const imageRows = batch.map((t) => {
            const supaProductId = supaProductMap.get(t.id);
            if (!supaProductId) return null;
            return {
                product_id: supaProductId,
                image_url: `/odoo-image/product.template/${t.id}/image_1920`,
                alt_text: t.name,
                display_order: 0,
                is_primary: true,
            };
        }).filter(Boolean);

        if (imageRows.length > 0) {
            const productIds = imageRows.map((r) => r!.product_id);
            await supabase.from("product_images").delete().in("product_id", productIds).eq("is_primary", true);
            const { error: imgError } = await supabase.from("product_images").insert(imageRows);
            if (!imgError) imagesUpserted += imageRows.length;
            else log.push(`  WARN: Image insert batch ${i}: ${imgError.message}`);
        }
    }

    // ── Step 6: Mark products not in Odoo as out of stock ──
    const activeOdooIds = allTemplates.map((t) => t.id);
    const { error: deactivateError } = await supabase
        .from("products")
        .update({ in_stock: false })
        .not("odoo_product_id", "in", `(${activeOdooIds.join(",")})`);

    if (deactivateError) {
        log.push(`WARN: Could not deactivate old products: ${deactivateError.message}`);
    }

    log.push(`\n=== SYNC COMPLETE ===`);
    log.push(`Products upserted: ${productsUpserted}`);
    log.push(`Variants upserted: ${variantsUpserted}`);
    log.push(`Images uploaded: ${imagesUpserted}`);

    return { success: true, log };
}

/** Extract size from SKU pattern like "DRE-ALI-WH_BL-SHI-COT/L" → "L" */
function extractSizeFromSku(sku: string): string | null {
    const parts = sku.split("/");
    if (parts.length > 1) {
        const sizePart = parts[parts.length - 1];
        // Common size patterns
        const sizePatterns = ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "0S",
            "2_3", "3_4", "4_5", "5_6", "6_7", "7_8", "FREE", "F"];
        if (sizePatterns.includes(sizePart.toUpperCase())) {
            return sizePart.replace(/_/g, "-"); // "2_3" → "2-3"
        }
        return sizePart;
    }
    return null;
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
        const skipImages = body.skip_images === true;
        const result = await syncProducts(skipImages);
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Sync failed:", err);
        return new Response(
            JSON.stringify({ success: false, error: (err as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
