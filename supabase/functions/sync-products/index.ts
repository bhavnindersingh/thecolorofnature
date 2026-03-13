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

// ─── XML-RPC Helpers ─────────────────────────────────────────────────────────

function toXmlValue(value: unknown): string {
    if (typeof value === "string") return `<string>${escapeXml(value)}</string>`;
    if (typeof value === "number" && Number.isInteger(value)) return `<int>${value}</int>`;
    if (typeof value === "number") return `<double>${value}</double>`;
    if (typeof value === "boolean") return `<boolean>${value ? 1 : 0}</boolean>`;
    if (value === null || value === undefined) return `<nil/>`;
    if (Array.isArray(value)) {
        return `<array><data>${value.map((v) => `<value>${toXmlValue(v)}</value>`).join("")}</data></array>`;
    }
    if (typeof value === "object") {
        const members = Object.entries(value as Record<string, unknown>)
            .map(([k, v]) => `<member><name>${k}</name><value>${toXmlValue(v)}</value></member>`)
            .join("");
        return `<struct>${members}</struct>`;
    }
    return `<nil/>`;
}

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toParam(value: unknown): string {
    return `<param><value>${toXmlValue(value)}</value></param>`;
}

async function xmlrpcCall(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
    const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${params.map(toParam).join("")}</params>
</methodCall>`;

    const resp = await fetch(`${ODOO_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body,
    });

    const xml = await resp.text();
    return parseXmlRpcResponse(xml);
}

// ─── XML-RPC Response Parser (handles arrays, structs, all types) ────────────

function parseXmlRpcResponse(xml: string): unknown {
    // Check for fault
    const faultMatch = xml.match(/<fault>[\s\S]*?<string>([\s\S]*?)<\/string>/);
    if (faultMatch) throw new Error(`Odoo Fault: ${faultMatch[1]}`);

    // Extract params
    const paramsMatch = xml.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/);
    if (!paramsMatch) throw new Error("Invalid XML-RPC response");
    return parseXmlValue(paramsMatch[1].trim());
}

function parseXmlValue(xml: string): unknown {
    // Integer
    let m = xml.match(/^<(?:int|i4)>([-\d]+)<\/(?:int|i4)>$/);
    if (m) return parseInt(m[1]);

    // Double
    m = xml.match(/^<double>([-\d.]+)<\/double>$/);
    if (m) return parseFloat(m[1]);

    // Boolean
    m = xml.match(/^<boolean>([01])<\/boolean>$/);
    if (m) return m[1] === "1";

    // String
    m = xml.match(/^<string>([\s\S]*?)<\/string>$/);
    if (m) return m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

    // Nil
    if (xml.match(/^<nil\s*\/?>$/)) return null;

    // Array
    m = xml.match(/^<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>$/);
    if (m) {
        const values: unknown[] = [];
        const valueRegex = /<value>([\s\S]*?)<\/value>/g;
        let vm;
        while ((vm = valueRegex.exec(m[1])) !== null) {
            values.push(parseXmlValue(vm[1].trim()));
        }
        return values;
    }

    // Struct
    m = xml.match(/^<struct>([\s\S]*?)<\/struct>$/);
    if (m) {
        const obj: Record<string, unknown> = {};
        const memberRegex = /<member>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
        let mm;
        while ((mm = memberRegex.exec(m[1])) !== null) {
            obj[mm[1].trim()] = parseXmlValue(mm[2].trim());
        }
        return obj;
    }

    // Raw string (no tag wrapper — Odoo sometimes returns bare strings)
    return xml;
}

// ─── Odoo Helpers ────────────────────────────────────────────────────────────

async function getOdooUid(): Promise<number> {
    const uid = await xmlrpcCall("/xmlrpc/2/common", "authenticate", [
        ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {},
    ]);
    if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
    return uid;
}

async function odooExecute(uid: number, model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<unknown> {
    const params: unknown[] = [ODOO_DB, uid, ODOO_API_KEY, model, method, args];
    if (kwargs) params.push(kwargs);
    return xmlrpcCall("/xmlrpc/2/object", "execute_kw", params);
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

async function syncProducts() {
    const uid = await getOdooUid();
    const log: string[] = [];
    log.push(`Authenticated as UID: ${uid}`);

    // ── Step 1: Fetch all saleable product templates in batches ──
    const templateCount = await odooExecute(uid, "product.template", "search_count", [
        [["sale_ok", "=", true], ["active", "=", true]],
    ]) as number;
    log.push(`Found ${templateCount} saleable templates`);

    const allTemplates: OdooTemplate[] = [];
    for (let offset = 0; offset < templateCount; offset += BATCH_SIZE) {
        const batch = await odooExecute(uid, "product.template", "search_read", [
            [["sale_ok", "=", true], ["active", "=", true]],
        ], {
            fields: ["name", "description_sale", "list_price", "categ_id", "image_1920", "product_variant_ids", "product_variant_count", "active"],
            offset,
            limit: BATCH_SIZE,
        }) as OdooTemplate[];
        allTemplates.push(...batch);
        log.push(`  Fetched templates ${offset + 1}-${offset + batch.length}`);
    }

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

            return {
                odoo_product_id: t.id,
                name: t.name,
                description: t.description_sale || null,
                price: t.list_price,
                category: leafCategory,
                in_stock: hasStock,
                image_url: null as string | null, // Will be set if image exists
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

        // Upload images for products that have them
        for (const t of batch) {
            if (!t.image_1920) continue;
            const supaProductId = supaProductMap.get(t.id);
            if (!supaProductId) continue;

            try {
                // Decode base64 image and upload to Supabase Storage
                const imageBytes = Uint8Array.from(atob(t.image_1920 as string), (c) => c.charCodeAt(0));
                const imagePath = `products/${t.id}/main.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from("product-images")
                    .upload(imagePath, imageBytes, {
                        contentType: "image/jpeg",
                        upsert: true,
                    });

                if (uploadError && !uploadError.message.includes("already exists")) {
                    log.push(`  WARN: Image upload failed for product ${t.id}: ${uploadError.message}`);
                    continue;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from("product-images")
                    .getPublicUrl(imagePath);

                const imageUrl = urlData.publicUrl;

                // Update product with image URL
                await supabase
                    .from("products")
                    .update({ image_url: imageUrl })
                    .eq("odoo_product_id", t.id);

                // Upsert into product_images table
                const { error: imgError } = await supabase
                    .from("product_images")
                    .upsert({
                        product_id: supaProductId,
                        image_url: imageUrl,
                        alt_text: t.name,
                        display_order: 0,
                        is_primary: true,
                    }, { onConflict: "product_id,is_primary" });

                if (!imgError) imagesUpserted++;
            } catch (imgErr) {
                log.push(`  WARN: Image processing failed for product ${t.id}: ${(imgErr as Error).message}`);
            }
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
        const result = await syncProducts();
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
