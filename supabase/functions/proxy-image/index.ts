import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ODOO_URL = Deno.env.get("ODOO_URL")!;

serve(async (req) => {
    const url = new URL(req.url);
    // ?path=product.template/3438/image_1920
    const imagePath = url.searchParams.get("path") || "";

    if (!imagePath) {
        return new Response("Missing path param", { status: 400 });
    }

    try {
        const odooResp = await fetch(`${ODOO_URL}/web/image/${imagePath}`);
        const contentType = odooResp.headers.get("Content-Type") || "image/jpeg";
        const body = await odooResp.arrayBuffer();

        return new Response(body, {
            status: odooResp.status,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err) {
        return new Response("Image fetch failed", { status: 502 });
    }
});
