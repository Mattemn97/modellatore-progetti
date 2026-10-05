/* --- PAGINA DI ERRORE ALL'AVVIO --- */

function escape(testo: string): string {
    return testo.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function urlPaginaErrore(titolo: string, motivo: string, dettagli: string, suggerimento: string): string {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Errore</title>
<style>
body { font-family: "Segoe UI", sans-serif; background: #f4f6f8; color: #2c3e50; margin: 0; padding: 40px; }
.riquadro { max-width: 760px; margin: 0 auto; background: white; border-left: 5px solid #c0392b; padding: 24px 28px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
h1 { font-size: 20px; margin: 0 0 12px; color: #c0392b; }
pre { background: #2c3e50; color: #ecf0f1; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px; max-height: 300px; white-space: pre-wrap; }
code { background: #ecf0f1; padding: 2px 5px; border-radius: 3px; }
</style></head><body><div class="riquadro">
<h1>${escape(titolo)}</h1>
<p>${escape(motivo)}</p>
<p>${suggerimento}</p>
${dettagli ? `<pre>${escape(dettagli)}</pre>` : ''}
</div></body></html>`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}
