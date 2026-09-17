import { Renderer } from './gpu/renderer';

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = await Renderer.create(canvas);

  const resize = (): void => {
    renderer.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  const frame = (): void => {
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:red;padding:1rem';
  pre.textContent = String(err);
  document.body.replaceChildren(pre);
});
