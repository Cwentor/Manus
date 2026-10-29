/* ==========================================================================
   click-fx.js — 蔚蓝档案风格点击 / 拖尾特效（ba-click-fx 精简版）引导模块

   设计约束（对应本项目「零打包工具 + 首屏优先」的取舍）：
     1. 懒加载：202 KB 的 vendor 模块不进首屏关键路径。首次指针交互立刻拉，
        或 load 之后空闲时后台补拉，两条路径都只执行一次。
     2. 暗 / 浅两种主题都启用。库内部固定 screen（加亮）混合，浅色底没有增亮
        空间，所以由 components.css 按 <html data-theme> 把覆盖层改成 multiply
        + 提饱和（白底 × 蓝光 = 蓝，光弧保色）。混合方式在 CSS 里，切换主题
        无需重建实例，因此这里不再监听主题做 destroy。
     3. 门控：prefers-reduced-motion 或触屏（pointer: coarse）直接不加载；
        没有 WebGL2 也放弃。
     4. 省电：标签页隐藏时 setPaused(true)，回来再恢复，不空转 GPU 帧。
     5. 依赖用「模块自身相对路径」引用（./vendor/…），因此本文件在
        /articles/ 下的页面里同样能正确解析，不依赖页面层级。
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');

  let fx = null;          // 生效实例
  let loading = false;    // 正在拉取 / 构造中
  let disabled = false;   // 初始化失败或用户要求减少动效：本页不再尝试
  let paused = false;

  /** 当前环境是否该启用特效 */
  function eligible() {
    if (disabled || loading || fx) return false;
    if (reducedMotion.matches || coarsePointer.matches) return false;
    if (typeof WebGL2RenderingContext === 'undefined') return false;
    return true;
  }

  function setPaused(next) {
    if (!fx || paused === next) return;
    paused = next;
    try { fx.setPaused(next, { clear: next }); } catch { /* 实例已销毁，忽略 */ }
  }

  function teardown() {
    if (!fx) return;
    try { fx.destroy(); } catch { /* 忽略 */ }
    fx = null;
    paused = false;
  }

  async function start() {
    if (!eligible()) return;
    loading = true;
    try {
      const mod = await import('./vendor/ba-click-fx.slim.js');
      const ClickFX = mod.BAClickFX || mod.default;
      // 加载期间环境可能已变（用户打开了「减少动效」），构造前再判一次
      if (reducedMotion.matches || coarsePointer.matches) return;
      fx = new ClickFX({
        onError(err) {
          // 精简版只有 WebGL2 一条路：初始化失败就彻底放弃，控制台留一条记录
          disabled = true;
          fx = null;
          console.warn('[click-fx] 特效初始化失败，已停用：', err && (err.code || err.message));
        },
      });
      paused = false;
      if (document.hidden) setPaused(true);
      syncLightCompositing();
    } catch (err) {
      disabled = true;
      console.warn('[click-fx] 模块加载失败，已停用：', err && err.message);
    } finally {
      loading = false;
    }
  }

  /* ---- 触发路径一：首次指针交互（效果本来也只在交互时可见） ---- */
  const onFirstPointer = () => {
    window.removeEventListener('pointerdown', onFirstPointer, true);
    window.removeEventListener('pointermove', onFirstPointer, true);
    start();
  };
  window.addEventListener('pointerdown', onFirstPointer, { capture: true, passive: true });
  window.addEventListener('pointermove', onFirstPointer, { capture: true, passive: true });

  /* ---- 触发路径二：页面空闲时后台预热，避免首次点击才现下载 ---- */
  const warmUp = () => {
    if (document.hidden) return;
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => start(), { timeout: 4000 });
    } else {
      setTimeout(start, 2500);
    }
  };
  if (document.readyState === 'complete') warmUp();
  else window.addEventListener('load', warmUp, { once: true });

  /* ---- 主题切换：混合方式由 components.css 按 data-theme 自动接管 ----
     CSS 用 :has() 命中覆盖层容器。极老的浏览器不支持 :has()，此时退化为
     JS 直接给容器打内联 !important，保证浅色主题不会退回看不见的 screen。 */
  const supportsHas = (() => {
    try { return CSS.supports('selector(:has(*))'); } catch { return false; }
  })();

  function syncLightCompositing() {
    if (supportsHas || !fx) return;
    const wrap = fx.canvas && fx.canvas.parentElement;
    if (!wrap) return;
    const light = root.dataset.theme === 'light';
    wrap.style.setProperty('mix-blend-mode', light ? 'multiply' : 'screen', 'important');
    wrap.style.setProperty('filter', light ? 'saturate(2.2) brightness(0.72)' : 'none', 'important');
  }

  new MutationObserver(syncLightCompositing).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  /* ---- 省电：页面不可见时暂停渲染 ---- */
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  /* ---- 用户在系统里开启「减少动效」：立即销毁，不再打扰 ---- */
  reducedMotion.addEventListener('change', (e) => {
    if (!e.matches) return;
    disabled = true;
    teardown();
  });
})();
