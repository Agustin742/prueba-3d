import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

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
  // Keep the most recent 4 lines so the bubble fits harmoniously
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

    // 1. Draw Name Tag Pill at bottom center
    const nameY = bubbleText ? 410 : 380;
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    const nameWidth = Math.max(200, ctx.measureText(name).width + 60);
    const nameX = (1024 - nameWidth) / 2;
    const nameHeight = 64;
    const radius = 18;

    // Background pill
    ctx.fillStyle = isSelf ? 'rgba(38, 70, 58, 0.96)' : 'rgba(32, 24, 38, 0.94)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(nameX, nameY, nameWidth, nameHeight, radius);
    } else {
      ctx.rect(nameX, nameY, nameWidth, nameHeight);
    }
    ctx.fill();

    // Name border
    ctx.strokeStyle = isSelf ? '#5eead4' : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 512, nameY + nameHeight / 2 + 1);

    // 2. Draw Chat Bubble if there is an active message
    if (bubbleText) {
      ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
      const maxBubbleWidth = 880;
      const lines = wrapText(ctx, bubbleText, maxBubbleWidth - 60);
      const lineHeight = 44;
      const bubbleHeight = Math.max(90, lines.length * lineHeight + 44);
      const measuredLineWidths = lines.map((l) => ctx.measureText(l).width);
      const textBlockWidth = Math.max(...measuredLineWidths, 160);
      const bubbleWidth = Math.min(maxBubbleWidth, textBlockWidth + 70);
      const bubbleX = (1024 - bubbleWidth) / 2;
      const bubbleY = nameY - bubbleHeight - 24;

      // Outer drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;

      // Bubble Body (Solid pure white card)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 20);
      } else {
        ctx.rect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);
      }
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Thick Dark Border
      ctx.strokeStyle = '#1e162a';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Pointer Triangle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(512 - 16, bubbleY + bubbleHeight - 1);
      ctx.lineTo(512 + 16, bubbleY + bubbleHeight - 1);
      ctx.lineTo(512, bubbleY + bubbleHeight + 18);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1e162a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(512 - 16, bubbleY + bubbleHeight);
      ctx.lineTo(512, bubbleY + bubbleHeight + 18);
      ctx.lineTo(512 + 16, bubbleY + bubbleHeight);
      ctx.stroke();

      // Text inside the bubble
      ctx.fillStyle = '#110c18';
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

  sprite.scale.set(4.4, 2.2, 1);
  sprite.position.y = 2.7;
  return sprite;
}
