import type { Wireframe } from "../../../interfaces/artboard";

export function findOpenSpaceForPage(
  allShapes: Wireframe[],
  pageToPlace: Wireframe
): { xOffset: number; yOffset: number } {
  const existingPages = allShapes.filter((shape) => shape.type === "page");

  const gridSize = 100;

  let placementAttempt = 0;
  const maxAttempts = 20;

  const pageWidth = pageToPlace.width;
  const pageHeight = pageToPlace.height;

  let candidateX = pageToPlace.xOffset;
  let candidateY = pageToPlace.yOffset;

  const doesOverlap = (x: number, y: number) => {
    return existingPages.some((page) => {
      const buffer = 20;

      const overlapX =
        x < page.xOffset + page.width + buffer &&
        x + pageWidth + buffer > page.xOffset;

      const overlapY =
        y < page.yOffset + page.height + buffer &&
        y + pageHeight + buffer > page.yOffset;

      return overlapX && overlapY;
    });
  };

  if (!doesOverlap(candidateX, candidateY)) {
    return { xOffset: candidateX, yOffset: candidateY };
  }

  while (placementAttempt < maxAttempts) {
    placementAttempt++;

    if (placementAttempt === 1) {
      const rightmostPage = existingPages.reduce((rightmost, page) => {
        return page.xOffset + page.width > rightmost.xOffset + rightmost.width
          ? page
          : rightmost;
      }, existingPages[0]);

      candidateX = rightmostPage.xOffset + rightmostPage.width + 40;
      candidateY = rightmostPage.yOffset;
    } else if (placementAttempt === 2) {
      const bottommostPage = existingPages.reduce((bottommost, page) => {
        return page.yOffset + page.height >
          bottommost.yOffset + bottommost.height
          ? page
          : bottommost;
      }, existingPages[0]);

      candidateX = bottommostPage.xOffset;
      candidateY = bottommostPage.yOffset + bottommostPage.height + 40;
    } else {
      const radius = Math.floor(placementAttempt / 2) * gridSize;
      const angle = (placementAttempt % 8) * (Math.PI / 4);

      const centerX =
        existingPages.reduce(
          (sum, page) => sum + page.xOffset + page.width / 2,
          0
        ) / existingPages.length;
      const centerY =
        existingPages.reduce(
          (sum, page) => sum + page.yOffset + page.height / 2,
          0
        ) / existingPages.length;

      candidateX = centerX + radius * Math.cos(angle) - pageWidth / 2;
      candidateY = centerY + radius * Math.sin(angle) - pageHeight / 2;
    }

    if (!doesOverlap(candidateX, candidateY)) {
      return { xOffset: candidateX, yOffset: candidateY };
    }
  }

  return {
    xOffset: pageToPlace.xOffset + 100 + placementAttempt * 20,
    yOffset: pageToPlace.yOffset + 100 + placementAttempt * 20,
  };
}

export function isShapeInsidePage(shape: Wireframe, page: Wireframe): boolean {
  if (shape.id === page.id) return false;

  return (
    shape.xOffset >= page.xOffset &&
    shape.yOffset >= page.yOffset &&
    shape.xOffset + shape.width <= page.xOffset + page.width &&
    shape.yOffset + shape.height <= page.yOffset + page.height
  );
}
