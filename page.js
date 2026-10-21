const root=document.documentElement;
const themeButton=document.querySelector('.theme-button');
let theme='spring';
try{theme=localStorage.getItem('feiyue-download-theme')==='minimal'?'minimal':'spring';}catch{}
function applyTheme(){root.dataset.theme=theme;themeButton.textContent=theme==='minimal'?'春日彩色':'简约配色';themeButton.setAttribute('aria-pressed',String(theme==='minimal'));themeButton.title=theme==='minimal'?'切换到春日配色':'切换到简约配色';}
applyTheme();
themeButton.addEventListener('click',()=>{theme=theme==='spring'?'minimal':'spring';applyTheme();try{localStorage.setItem('feiyue-download-theme',theme);}catch{}});
document.querySelector('#copy-checksum').addEventListener('click',async()=>{const value=document.querySelector('#checksum').textContent.trim();const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText(value);status.textContent='已复制';}catch{status.textContent='复制不可用，请选中上方校验值手动复制。';}});
