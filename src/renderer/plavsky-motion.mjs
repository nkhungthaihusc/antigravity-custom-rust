// Decorative motion only; never controls authentication or App readiness.
export function mountPlavskyMotion(root,enabled){
 if(!enabled)return()=>{};
 const layer=document.createElement('div');layer.className='plavsky-motion';layer.setAttribute('aria-hidden','true');
 const scan=document.createElement('div');scan.className='plavsky-scan';layer.append(scan);
 const ring=document.createElement('div');ring.className='plavsky-ring';layer.append(ring);
 for(let i=0;i<18;i++){const particle=document.createElement('i');particle.className='plavsky-particle';particle.style.setProperty('--x',`${30+(i*17%42)}%`);particle.style.setProperty('--delay',`${-(i*.37)}s`);particle.style.setProperty('--drift',`${(i%5-2)*12}px`);layer.append(particle);}
 const visibility=()=>layer.classList.toggle('plavsky-paused',document.hidden);
 root.append(layer);document.addEventListener('visibilitychange',visibility);visibility();
 return()=>{document.removeEventListener('visibilitychange',visibility);layer.remove();};
}
