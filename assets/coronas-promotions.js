(function(){
 "use strict";
 const root=document.getElementById("coronasPromoCarousel");
 if(!root||root.dataset.ready==="true")return;
 const slides=Array.from(root.querySelectorAll("[data-coronas-slide]"));
 const dots=Array.from(root.querySelectorAll("[data-coronas-dot]"));
 const previous=root.querySelector("[data-coronas-prev]");
 const next=root.querySelector("[data-coronas-next]");
 if(slides.length<2)return;
 root.dataset.ready="true";
 let current=0,timer=null,paused=false,startX=null;
 const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function show(index){
  current=(index+slides.length)%slides.length;
  slides.forEach((slide,i)=>{
   const active=i===current;
   slide.classList.toggle("is-active",active);
   slide.setAttribute("aria-hidden",active?"false":"true");
  });
  dots.forEach((dot,i)=>{
   dot.setAttribute("aria-current",i===current?"true":"false");
   dot.setAttribute("aria-label","Mostrar promoción "+(i+1));
  });
 }
 function stop(){if(timer){window.clearInterval(timer);timer=null;}}
 function start(){
  stop();
  if(reduced||paused||document.hidden)return;
  timer=window.setInterval(()=>show(current+1),7000);
 }
 previous?.addEventListener("click",()=>{show(current-1);start();});
 next?.addEventListener("click",()=>{show(current+1);start();});
 dots.forEach((dot,i)=>dot.addEventListener("click",()=>{show(i);start();}));
 root.addEventListener("mouseenter",()=>{paused=true;stop();});
 root.addEventListener("mouseleave",()=>{paused=false;start();});
 root.addEventListener("focusin",()=>{paused=true;stop();});
 root.addEventListener("focusout",event=>{
  if(!root.contains(event.relatedTarget)){paused=false;start();}
 });
 root.addEventListener("pointerdown",event=>{if(event.pointerType!=="mouse")startX=event.clientX;},{passive:true});
 root.addEventListener("pointerup",event=>{
  if(startX===null)return;
  const distance=event.clientX-startX;
  if(Math.abs(distance)>42)show(current+(distance<0?1:-1));
  startX=null;start();
  },{passive:true});
 root.addEventListener("pointercancel",()=>{startX=null;});
 document.addEventListener("visibilitychange",start);
 show(0);start();
})();