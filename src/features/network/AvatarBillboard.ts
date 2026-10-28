import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
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
  return lines.slice(0, 3); // Max 3 lines
}

export function createAvatarBillboard(
  name: string,
  bubbleText?: string | null,
  isSelf = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Name Tag Pill at the bottom center
    const nameY = bubbleText ? 200 : 190;
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    const nameWidth = Math.max(120, ctx.measureText(name).width + 36);
    const nameX = (512 - nameWidth) / 2;
    const nameHeight = 44;
    const radius = 12;

    ctx.fillStyle = isSelf ? 'rgba(59, 82, 73, 0.9)' : 'rgba(40, 34, 46, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(nameX, nameY, nameWidth, nameHeight, radius);
    } else {
      ctx.rect(nameX, nameY, nameWidth, nameHeight);
    }
    ctx.fill();

    // Name border
    ctx.strokeStyle = isSelf ? '#62cfc7' : '#af7b52';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 256, nameY + nameHeight / 2);

    // 2. Draw Chat Bubble if there is an active message
    if (bubbleText) {
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';
      const maxBubbleWidth = 440;
      const lines = wrapText(ctx, bubbleText, maxBubbleWidth - 40);
      const lineHeight = 28;
      const bubbleHeight = Math.max(60, lines.length * lineHeight + 26);
      const measuredLineWidths = lines.map((l) => ctx.measureText(l).width);
      const textBlockWidth = Math.max(...measuredLineWidths, 80);
      const bubbleWidth = Math.min(maxBubbleWidth, textBlockWidth + 40);
      const bubbleX = (512 - bubbleWidth) / 2;
      const bubbleY = nameY - bubbleHeight - 16;

      // Bubble Body (white card with soft shadow)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 14);
      } else {
        ctx.rect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);
      }
      ctx.fill();

      // Bubble Border
      ctx.strokeStyle = '#af7b52';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bubble Pointer Triangle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(256 - 10, bubbleY + bubbleHeight - 1);
      ctx.lineTo(256 + 10, bubbleY + bubbleHeight - 1);
      ctx.lineTo(256, bubbleY + bubbleHeight + 11);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#af7b52';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(256 - 10, bubbleY + bubbleHeight);
      ctx.lineTo(256, bubbleY + bubbleHeight + 11);
      ctx.lineTo(256 + 10, bubbleY + bubbleHeight);
      ctx.stroke();

      // Message lines
      ctx.fillStyle = '#2e2633';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textStartY = bubbleY + bubbleHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, 256, textStartY + index * lineHeight);
      });
    }
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(2.4, 1.2, 1);
  sprite.position.y = 2.4;
  return sprite;
}

