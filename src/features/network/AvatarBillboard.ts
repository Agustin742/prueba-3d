import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

// =========================================================================
// CONFIGURACIÓN VISUAL DEL GLOBO Y APODO
// Podés ajustar estos valores para cambiar el tamaño y escala a tu gusto:
// =========================================================================
export const BILLBOARD_CONFIG = {
  // Escala del sprite 3D en el mundo
  scaleX: 5.4,          // Ancho del globo en el espacio 3D
  scaleY: 2.7,          // Alto del globo en el espacio 3D
  heightY: 2.85,        // Altura sobre los pies del personaje

  // Tipografía en el canvas
  bubbleFontSize: 42,   // Tamaño de letra del texto del mensaje
  nameFontSize: 36,     // Tamaño de letra del apodo
  lineHeight: 50,       // Separación entre líneas
  maxBubbleWidth: 900,  // Ancho máximo del globo de texto
};
// =========================================================================

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.measureText(testLine).width;
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  // Permitir hasta 4 líneas visibles
  return lines.slice(-4);
}

export function createAvatarBillboard(
  name: string,
  bubbleText?: string | null,
  isSelf = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Etiqueta con el Apodo (Pill en la parte inferior)
    const nameY = bubbleText ? 410 : 380;
    ctx.font = `bold ${BILLBOARD_CONFIG.nameFontSize}px system-ui, -apple-system, sans-serif`;
    const nameWidth = Math.max(220, ctx.measureText(name).width + 60);
    const nameX = (1024 - nameWidth) / 2;
    const nameHeight = 64;
    const radius = 18;

    // Fondo del nombre
    ctx.fillStyle = isSelf ? 'rgba(38, 70, 58, 0.96)' : 'rgba(32, 24, 38, 0.94)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(nameX, nameY, nameWidth, nameHeight, radius);
    } else {
      ctx.rect(nameX, nameY, nameWidth, nameHeight);
    }
    ctx.fill();

    // Borde del nombre
    ctx.strokeStyle = isSelf ? '#5eead4' : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Texto del nombre
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 512, nameY + nameHeight / 2 + 1);

    // 2. Globito de Diálogo (si hay mensaje activo)
    if (bubbleText) {
      ctx.font = `bold ${BILLBOARD_CONFIG.bubbleFontSize}px system-ui, -apple-system, sans-serif`;
      const lines = wrapText(ctx, bubbleText, BILLBOARD_CONFIG.maxBubbleWidth - 60);
      const lineHeight = BILLBOARD_CONFIG.lineHeight;
      const bubbleHeight = Math.max(100, lines.length * lineHeight + 46);
      const measuredLineWidths = lines.map((l) => ctx.measureText(l).width);
      const textBlockWidth = Math.max(...measuredLineWidths, 180);
      const bubbleWidth = Math.min(BILLBOARD_CONFIG.maxBubbleWidth, textBlockWidth + 80);
      const bubbleX = (1024 - bubbleWidth) / 2;
      const bubbleY = nameY - bubbleHeight - 24;

      // Sombra profunda para destacar contra cualquier fondo
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;

      // Cuerpo blanco sólido del globo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 22);
      } else {
        ctx.rect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);
      }
      ctx.fill();

      // Resetear sombra para bordes y texto definidos
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Borde oscuro y grueso
      ctx.strokeStyle = '#1a1024';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Puntero triangular apuntando al nombre
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(512 - 18, bubbleY + bubbleHeight - 1);
      ctx.lineTo(512 + 18, bubbleY + bubbleHeight - 1);
      ctx.lineTo(512, bubbleY + bubbleHeight + 20);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1a1024';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(512 - 18, bubbleY + bubbleHeight);
      ctx.lineTo(512, bubbleY + bubbleHeight + 20);
      ctx.lineTo(512 + 18, bubbleY + bubbleHeight);
      ctx.stroke();

      // Texto en negrita de alto contraste
      ctx.fillStyle = '#100a18';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textStartY = bubbleY + bubbleHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, 512, textStartY + index * lineHeight);
      });
    }
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new Sprite(material);

  sprite.scale.set(BILLBOARD_CONFIG.scaleX, BILLBOARD_CONFIG.scaleY, 1);
  sprite.position.y = BILLBOARD_CONFIG.heightY;
  return sprite;
}
