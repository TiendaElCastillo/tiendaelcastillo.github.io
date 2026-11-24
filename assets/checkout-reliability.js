(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 function progress(phase,percent,message){
  const panel=$("proofUploadCircuit");
  if(!panel)return;
  panel.hidden=false;
  panel.classList.remove("hidden","is-error","is-done");
  if(phase==="error")panel.classList.add("is-error");
  if(phase==="done")panel.classList.add("is-done");
  const value=Math.max(0,Math.min(100,Number(percent)||0));
  const fill=$("proofUploadFill");
  const track=$("proofUploadTrack");
  const stage=$("proofUploadStage");
  const percentLabel=$("proofUploadPercent");
  const note=$("proofUploadMessage");
  if(fill)fill.style.width=value+"%";
  if(track)track.setAttribute("aria-valuenow",String(Math.round(value)));
  if(percentLabel)percentLabel.textContent=Math.round(value)+"%";
  const labels={prepare:"Preparando captura",upload:"Subiendo captura",verify:"Verificando recepción",done:"Comprobante recibido",error:"Subida interrumpida"};
  if(stage)stage.textContent=labels[phase]||"Procesando comprobante";
  if(note)note.textContent=message||"";
  const active=phase==="done"?3:phase==="verify"||phase==="error"?2:phase==="upload"?1:0;
  panel.querySelectorAll("[data-proof-step]").forEach(node=>{
   const key=node.getAttribute("data-proof-step");
   const index=key==="prepare"?0:key==="upload"?1:2;
   node.classList.toggle("is-active",index===active&&phase!=="done"&&phase!=="error");
   node.classList.toggle("is-done",phase==="done"||index<active);
   node.classList.toggle("is-error",phase==="error"&&index===2);
  });
 }
 window.castleSetProofUploadProgress=progress;
 window.castleResetProofUploadProgress=function(){
  const panel=$("proofUploadCircuit");
  if(!panel)return;
  panel.classList.add("hidden");
  panel.classList.remove("is-error","is-done");
  const fill=$("proofUploadFill");
  const track=$("proofUploadTrack");
  const percent=$("proofUploadPercent");
  const stage=$("proofUploadStage");
  const message=$("proofUploadMessage");
  if(fill)fill.style.width="0%";
  if(track)track.setAttribute("aria-valuenow","0");
  if(percent)percent.textContent="0%";
  if(stage)stage.textContent="Preparando captura";
  if(message)message.textContent="Comprobando que todos los datos estén completos.";
  panel.querySelectorAll("[data-proof-step]").forEach(node=>node.classList.remove("is-active","is-done","is-error"));
 };

 async function uploadProofBinary(path,file,onProgress){
  if(typeof db==="undefined"||!db||typeof XMLHttpRequest==="undefined")throw new Error("No se pudo iniciar la subida segura de la captura.");
  let sessionResult;
  try{sessionResult=await db.auth.getSession();}
  catch(error){throw new Error("No se pudo comprobar tu sesión antes de subir la captura.");}
  const accessToken=sessionResult?.data?.session?.access_token;
  if(sessionResult?.error||!accessToken)throw new Error("Tu sesión caducó. Inicia sesión y vuelve a adjuntar la captura al mismo pedido.");
  const encodedPath=String(path).split("/").map(encodeURIComponent).join("/");
  const endpoint=STORE_SUPABASE_URL+"/storage/v1/object/payment-proofs/"+encodedPath;
  return new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();
   xhr.open("POST",endpoint,true);
   xhr.setRequestHeader("apikey",STORE_SUPABASE_KEY);
   xhr.setRequestHeader("Authorization","Bearer "+accessToken);
   xhr.setRequestHeader("Content-Type",file.type);
   xhr.setRequestHeader("cache-control","max-age=3600");
   xhr.setRequestHeader("x-upsert","false");
   xhr.upload.addEventListener("progress",event=>{
    if(event.lengthComputable&&typeof onProgress==="function"){
     onProgress(Math.min(100,Math.round(event.loaded/event.total*100)));
    }
   });
   xhr.onload=()=>{
    let payload={};
    try{payload=JSON.parse(xhr.responseText||"{}");}catch(error){}
    if(xhr.status<200||xhr.status>=300){
     reject(new Error(payload.message||payload.error||("El servidor no aceptó la captura (HTTP "+xhr.status+").")));
     return;
    }
    if(typeof onProgress==="function")onProgress(100);
    resolve(payload);
   };
   xhr.onerror=()=>reject(new Error("Se interrumpió la conexión durante la subida. Conservamos el pedido para que puedas reintentar con la misma captura."));
   xhr.onabort=()=>reject(new Error("La subida se canceló antes de terminar. No se envió el pedido a revisión."));
   xhr.ontimeout=()=>reject(new Error("La subida tardó demasiado y no se confirmó. Comprueba tu conexión y vuelve a intentarlo en el mismo pedido."));
   xhr.timeout=0;
   try{xhr.send(file);}catch(error){reject(new Error("No se pudo enviar el archivo: "+(error?.message||"error desconocido")));}
  });
 }
 window.castleUploadProofBinary=uploadProofBinary;

 function validateCheckout(){
  if(typeof currentUser==="undefined"||!currentUser)return null;
  const fail=(message,field)=>({message,field});
  const productId=$("product")?.value||"";
  const product=(typeof products!=="undefined"?products:[]).find(item=>String(item.id)===String(productId));
  if(!product)return fail("Selecciona un paquete válido antes de enviar el pedido.","product");
  if(typeof isGlobalMobileLegendsProduct==="function"&&!isGlobalMobileLegendsProduct(product)){
   return fail("Mobile Legends solo admite productos de región GLOBAL.","product");
  }
  const player=String($("player")?.value||"").trim();
  if(player.length<3||player.length>64)return fail("Completa correctamente el ID del jugador.","player");
  let targetConfig={ok:true,zoneKey:null};
  if(typeof providerPlayerTargetConfig==="function")targetConfig=providerPlayerTargetConfig(product)||targetConfig;
  if(targetConfig.ok===false)return fail("Este paquete no tiene un formato de ID compatible. No se creó ningún pedido.","player");
  if(targetConfig.zoneKey){
   const zone=String($("playerZone")?.value||"").trim();
   if(!zone||zone.length>24)return fail("Completa el Zone ID del servidor antes de continuar.","playerZone");
  }
  if(typeof requiresPlayerValidation==="function"&&requiresPlayerValidation(product)){
   if(!product.provider_product_id||product.provider_validation_supported!==true){
    return fail("Este paquete no tiene activa la verificación de cuenta. No se puede crear el pedido.","player");
   }
  }
  if($("privacyConsent")?.checked!==true)return fail("Acepta la Política de privacidad y los Términos de compra para enviar el pedido.","privacyConsent");
  const method=String(typeof checkoutLockedPaymentMethod!=="undefined"&&checkoutLockedPaymentMethod?checkoutLockedPaymentMethod:$("payment")?.value||"");
  if(!method||String($("payment")?.value||"")!==method)return fail("La forma de pago no coincide con la seleccionada. Vuelve al catálogo y elige el método.","payment");
  const isWallet=method==="Saldo de Tienda El Castillo";
  if(!isWallet&&!["Transferencia CUP","Saldo móvil","USDT"].includes(method))return fail("Esta forma de pago no está disponible.","payment");
  const ready=typeof isPaymentMethodReady==="function"?isPaymentMethodReady(method):
   isWallet?Boolean(currentUser):((typeof paymentMethods!=="undefined"?paymentMethods:[]).some(item=>item.name===method&&item.active===true&&String(item.instructions||"").trim()));
  if(!ready)return fail("Este método de pago no está disponible en este momento.","payment");
  const price=typeof priceForMethod==="function"?Number(priceForMethod(product,method)):0;
  if(!Number.isFinite(price)||price<=0)return fail("El paquete no tiene un precio válido para este método de pago.","payment");
  if(isWallet){
   const balance=typeof walletBalanceUSD!=="undefined"?Number(walletBalanceUSD):0;
   if(!Number.isFinite(balance)||balance<price)return fail("Tus Coronas no cubren este paquete.","payment");
   return null;
  }
  const file=$("paymentProof")?.files?.[0]||null;
  if(!file||!Number(file.size)||file.size<=0)return fail("Adjunta una captura válida del comprobante antes de enviar.","paymentProof");
  const fileError=typeof validateProofFile==="function"?validateProofFile(file):"No se pudo validar la captura.";
  if(fileError)return fail(fileError,"paymentProof");
  const phone=String($("senderPhone")?.value||"").trim();
  const national=typeof cubaMobileNational==="function"?cubaMobileNational(phone):"";
  const reference=String($("reference")?.value||"").trim().toUpperCase().replace(/\\s+/g,"");
  const amount=Number($("reportedAmount")?.value||0);
  if(method==="Transferencia CUP"){
   if(reference.length<3||reference.length>100)return fail("Escribe el número de transacción bancaria completo.","reference");
   if(!national)return fail("Escribe los 8 dígitos válidos del móvil desde el que pagaste.","senderPhone");
  }else if(method==="Saldo móvil"){
   if(reference)return fail("Saldo móvil no utiliza número de transacción. Borra ese campo y usa el importe del SMS.","reference");
   if(!national)return fail("Escribe los 8 dígitos válidos del móvil desde el que enviaste el saldo.","senderPhone");
   if(!Number.isFinite(amount)||amount<=0||Math.abs(amount-price)>0.01)return fail("El importe declarado debe coincidir exactamente con el precio del paquete.","reportedAmount");
  }else if(method==="USDT"){
   if(!/^[a-f0-9]{64}$/i.test(reference))return fail("Pega el hash/TxID completo de 64 caracteres.","reference");
   if(!Number.isFinite(amount)||amount<=0||Math.abs(amount-price)>0.000001)return fail("La cantidad declarada de USDT debe coincidir exactamente con el precio.","reportedAmount");
  }
  return null;
 }

 const originalPlaceOrder=window.placeOrder;
 if(typeof originalPlaceOrder==="function"&&!originalPlaceOrder.__castleReliableWrapped){
  const wrapped=async function(){
   if(window.__castleCheckoutSubmitting){
    const msg=$("ordermsg");if(msg)msg.textContent="Ya estamos procesando este pedido. No pulses otra vez ni repitas el pago.";
    return;
   }
   const invalid=validateCheckout();
   if(invalid){
    const msg=$("ordermsg");if(msg)msg.textContent=invalid.message;
    const field=$(invalid.field);if(field&&typeof field.focus==="function")field.focus();
    window.updateCheckoutSubmitState?.();
    return;
   }
   window.__castleCheckoutSubmitting=true;
   const button=$("placeOrderBtn");
   if(button){button.disabled=true;button.textContent="Comprobando datos…";}
   progress("prepare",0,"Comprobando los datos y preparando la captura…");
   try{
    return await originalPlaceOrder.apply(this,arguments);
   }catch(error){
    progress("error",0,"No se pudo completar el envío. Revisa el mensaje y vuelve a intentarlo con el mismo pedido.");
    throw error;
   }finally{
    window.__castleCheckoutSubmitting=false;
    window.updateCheckoutSubmitState?.();
   }
  };
  wrapped.__castleReliableWrapped=true;
  window.placeOrder=wrapped;
 }
})();