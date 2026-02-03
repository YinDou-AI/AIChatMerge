import { describe, it, expect, beforeEach, vi } from 'vitest';

// 模拟 LAYOUT_PANEL_COUNTS 常量
const LAYOUT_PANEL_COUNTS = {
  '1x1': 1,
  '1x2': 2,
  '1x3': 3,
  '1x4': 4,
  '1x5': 5,
  '1x6': 6,
  '2x1': 2,
  '2x2': 4,
  '2x3': 6,
  '3x1': 3,
  '3x2': 6
};

// 被测试的函数（从 multi-panel.js 复制）
function getAutoAdjustedLayout(currentLayout, newPanelCount) {
  // 只处理 1xN 布局
  const match = currentLayout.match(/^1x(\d)$/);
  if (!match) return null;
  
  const currentCols = parseInt(match[1]);
  const currentCapacity = LAYOUT_PANEL_COUNTS[currentLayout];
  
  // 如果新面板数不超过容量，无需调整
  if (newPanelCount <= currentCapacity) return null;
  
  // 计算下一级布局
  const nextCols = currentCols + 1;
  const nextLayout = `1x${nextCols}`;
  
  // 检查是否存在（1x6 是上限）
  if (LAYOUT_PANEL_COUNTS[nextLayout]) {
    return nextLayout;
  }
  
  return null; // 已达上限，无法自动调整
}

// New auto-shrink function (from multi-panel.js)
function getAutoShrunkLayout(currentLayout, newPanelCount) {
  // Only handle 1xN layouts (consistent with auto-expand behavior)
  const match = currentLayout.match(/^1x(\d)$/);
  if (!match) return null;

  const currentCols = parseInt(match[1]);

  // No need to shrink if panel count already matches or exceeds column count
  if (newPanelCount >= currentCols) return null;

  // Shrink to match panel count (minimum 1x1)
  const targetCols = Math.max(newPanelCount, 1);
  const targetLayout = `1x${targetCols}`;

  if (LAYOUT_PANEL_COUNTS[targetLayout]) {
    return targetLayout;
  }

  return null;
}

describe('Layout Auto-Adjust', () => {
  describe('getAutoAdjustedLayout', () => {
    describe('1xN layout sequence', () => {
      it('should upgrade from 1x2 to 1x3 when adding 3rd panel', () => {
        expect(getAutoAdjustedLayout('1x2', 3)).toBe('1x3');
      });

      it('should upgrade from 1x3 to 1x4 when adding 4th panel', () => {
        expect(getAutoAdjustedLayout('1x3', 4)).toBe('1x4');
      });

      it('should upgrade from 1x4 to 1x5 when adding 5th panel', () => {
        expect(getAutoAdjustedLayout('1x4', 5)).toBe('1x5');
      });

      it('should upgrade from 1x5 to 1x6 when adding 6th panel', () => {
        expect(getAutoAdjustedLayout('1x5', 6)).toBe('1x6');
      });

      it('should NOT upgrade when panel count fits within capacity', () => {
        expect(getAutoAdjustedLayout('1x2', 2)).toBeNull();
        expect(getAutoAdjustedLayout('1x3', 3)).toBeNull();
        expect(getAutoAdjustedLayout('1x4', 4)).toBeNull();
        expect(getAutoAdjustedLayout('1x5', 5)).toBeNull();
        expect(getAutoAdjustedLayout('1x6', 6)).toBeNull();
      });

      it('should NOT upgrade when adding within capacity', () => {
        // 1x2 布局，只有 1 个面板，添加第 2 个时不需要升级
        expect(getAutoAdjustedLayout('1x2', 2)).toBeNull();
        // 1x3 布局，只有 2 个面板，添加第 3 个时不需要升级
        expect(getAutoAdjustedLayout('1x3', 3)).toBeNull();
      });
    });

    describe('upper limit (1x6)', () => {
      it('should return null when already at 1x6 maximum', () => {
        // 1x6 已满，无法再升级
        expect(getAutoAdjustedLayout('1x6', 7)).toBeNull();
      });
    });

    describe('non-1xN layouts', () => {
      it('should return null for 2xN layouts', () => {
        expect(getAutoAdjustedLayout('2x2', 5)).toBeNull();
        expect(getAutoAdjustedLayout('2x3', 7)).toBeNull();
      });

      it('should return null for 3xN layouts', () => {
        expect(getAutoAdjustedLayout('3x1', 4)).toBeNull();
        expect(getAutoAdjustedLayout('3x2', 7)).toBeNull();
      });

      it('should return null for 2x1 layout', () => {
        expect(getAutoAdjustedLayout('2x1', 3)).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle 1x1 layout correctly', () => {
        expect(getAutoAdjustedLayout('1x1', 2)).toBe('1x2');
        expect(getAutoAdjustedLayout('1x1', 1)).toBeNull();
      });

      it('should return null for invalid layouts', () => {
        expect(getAutoAdjustedLayout('invalid', 3)).toBeNull();
        expect(getAutoAdjustedLayout('', 3)).toBeNull();
        expect(getAutoAdjustedLayout('1x10', 11)).toBeNull();
      });
    });
  });

  describe('getAutoShrunkLayout', () => {
    describe('1xN layout sequence', () => {
      it('should shrink from 1x3 to 1x2 when removing panel (3 -> 2)', () => {
        expect(getAutoShrunkLayout('1x3', 2)).toBe('1x2');
      });

      it('should shrink from 1x2 to 1x1 when removing panel (2 -> 1)', () => {
        expect(getAutoShrunkLayout('1x2', 1)).toBe('1x1');
      });

      it('should shrink from 1x4 to 1x3 when removing panel (3 panels remain)', () => {
        expect(getAutoShrunkLayout('1x4', 3)).toBe('1x3');
      });

      it('should shrink from 1x5 to 1x4 when removing panel (4 panels remain)', () => {
        expect(getAutoShrunkLayout('1x5', 4)).toBe('1x4');
      });

      it('should shrink from 1x6 to 1x5 when removing panel (5 panels remain)', () => {
        expect(getAutoShrunkLayout('1x6', 5)).toBe('1x5');
      });

      it('should shrink from 1x7 to 1x6 when removing panel (6 panels remain)', () => {
        expect(getAutoShrunkLayout('1x7', 6)).toBe('1x6');
      });
    });

    describe('no shrink needed', () => {
      it('should NOT shrink when panel count matches column count', () => {
        expect(getAutoShrunkLayout('1x3', 3)).toBeNull();
        expect(getAutoShrunkLayout('1x2', 2)).toBeNull();
        expect(getAutoShrunkLayout('1x1', 1)).toBeNull();
      });

      it('should NOT shrink when panel count exceeds column count', () => {
        // e.g., in 1x2 layout but has 3 panels (should not happen in practice)
        expect(getAutoShrunkLayout('1x2', 3)).toBeNull();
        expect(getAutoShrunkLayout('1x3', 4)).toBeNull();
      });

      it('should maintain minimum 1x1 layout', () => {
        // Already at minimum, can't shrink further
        expect(getAutoShrunkLayout('1x1', 1)).toBeNull();
      });
    });

    describe('non-1xN layouts', () => {
      it('should return null for 2xN layouts (no auto-shrink)', () => {
        expect(getAutoShrunkLayout('2x2', 2)).toBeNull();
        expect(getAutoShrunkLayout('2x3', 4)).toBeNull();
      });

      it('should return null for 3xN layouts (no auto-shrink)', () => {
        expect(getAutoShrunkLayout('3x1', 2)).toBeNull();
        expect(getAutoShrunkLayout('3x2', 5)).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should return null for invalid layouts', () => {
        expect(getAutoShrunkLayout('invalid', 2)).toBeNull();
        expect(getAutoShrunkLayout('', 1)).toBeNull();
        expect(getAutoShrunkLayout('2x1', 1)).toBeNull();
      });

      it('should shrink to 1x1 when going from 2 panels to 1', () => {
        expect(getAutoShrunkLayout('1x2', 1)).toBe('1x1');
      });

      it('should shrink to 1x1 when going from 3 panels to 1', () => {
        expect(getAutoShrunkLayout('1x3', 1)).toBe('1x1');
      });
    });
  });
});
