export function licitacionEnviadaHtml(params: {
  clienteNombre: string;
  titulo: string;
  presupuestoMaximo: number;
  fechaLimite: string;
  productos: { nombre: string; cantidad: number; precio: number }[];
}): string {
  const filas = params.productos
    .map(
      (p) =>
        `<tr><td>${p.nombre}</td><td>${p.cantidad}</td><td>$${p.precio.toFixed(2)}</td><td>$${(p.cantidad * p.precio).toFixed(2)}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family: sans-serif;">
      <p>Estimado/a ${params.clienteNombre},</p>
      <p>Le enviamos formalmente la licitación "<strong>${params.titulo}</strong>" para su revisión.</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p><strong>Presupuesto máximo:</strong> $${params.presupuestoMaximo.toFixed(2)}</p>
      <p><strong>Fecha límite:</strong> ${new Date(params.fechaLimite).toLocaleString("es")}</p>
      <p>Adjuntamos el documento de propuesta formal.</p>
    </div>
  `;
}
