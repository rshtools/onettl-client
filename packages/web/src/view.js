
import { decryptSecret } from './crypto.js';
import { copyFrom } from './dom.js';

(function(){
  function show(id){ var el=document.getElementById(id); if(el) el.hidden=false; }
  function hide(id){ var el=document.getElementById(id); if(el) el.hidden=true; }

  var parts=location.pathname.split('/s/');
  var id = parts.length>1 ? parts[1].split('/')[0].split('?')[0] : null;
  var keyB64 = new URLSearchParams(location.hash.slice(1)).get('k');

  var state={ resp:null };

  async function decryptAndShow(){
    // Fragment key required.
    if(!keyB64){ hide('loading'); show('nokey'); return; }
    var pt=await decryptSecret(state.resp, keyB64);
    revealText(pt);
  }
  function revealText(text){
    var out=document.getElementById('out');
    out.textContent=text;
    hide('reveal-panel'); hide('passprompt'); hide('verify'); show('revealed');
    show('viral');
  }

  async function doOpen(){
    hide('reveal-error');
    var btn=document.getElementById('reveal');
    btn.disabled=true; btn.textContent='Opening...';
    try {
      var headers={'content-type':'application/json'};
      var vtok=sessionStorage.getItem('ottl_vt_'+id);
      if(vtok){ headers['x-onettl-verify-token']=vtok; }
      var res=await fetch('/api/v1/secrets/'+id+'/open', { method:'POST', headers:headers, body:'{}' });
      if(!res.ok){
        var j=await res.json().catch(function(){ return {}; });
        if(res.status===401 && j.error==='need_verification'){ hide('reveal-panel'); show('verify'); return; }
        hide('reveal-panel'); show('gone');
        var g=document.getElementById('gone-msg');
        if(g && j.message){ g.textContent=j.message; }
        return;
      }
      var data=await res.json();
      state.resp={ ciphertext:data.ciphertext, encryption_mode:data.encryption_mode||'aesgcm', salt:data.salt };
      if(state.resp.encryption_mode==='aesgcm_pbkdf2'){
        hide('reveal-panel'); show('passprompt');
        var pf=document.getElementById('pass'); if(pf) pf.focus();
      } else {
        await decryptAndShow();
      }
    } catch(e){
      hide('reveal-panel'); show('nokey');
    } finally {
      btn.disabled=false; btn.textContent='Reveal secret';
    }
  }

  async function unlockWithPass(){
    hide('passerr');
    try {
      var pass=document.getElementById('pass').value;
      var pt=await decryptSecret(state.resp, keyB64, pass);
      revealText(pt);
    } catch(e){ show('passerr'); }
  }

  // Wire up. Show reveal panel only if we have an id (never auto-open).
  if(!id){ hide('loading'); show('gone'); return; }
  hide('loading'); show('reveal-panel');

  var revealBtn=document.getElementById('reveal');
  if(revealBtn) revealBtn.addEventListener('click', doOpen);
  var unlockBtn=document.getElementById('unlock');
  if(unlockBtn) unlockBtn.addEventListener('click', unlockWithPass);
  var passInput=document.getElementById('pass');
  if(passInput) passInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ unlockWithPass(); } });
  var copyBtn=document.getElementById('copy');
  if(copyBtn) copyBtn.addEventListener('click', function(){ copyFrom(document.getElementById('out'), this); });

  // Recipient verification (Team). Requests a code, then submits it.
  var reqCodeBtn=document.getElementById('verify-request');
  if(reqCodeBtn) reqCodeBtn.addEventListener('click', async function(){
    var email=document.getElementById('verify-email').value;
    var r=await fetch('/api/v1/secrets/'+id+'/verify', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email: email }) });
    var j=await r.json().catch(function(){ return {}; });
    var msg=document.getElementById('verify-msg');
    if(msg) msg.textContent = j.message || 'Check your email for a 6-digit code.';
    show('verify-code-row');
  });
  var subCodeBtn=document.getElementById('verify-submit');
  if(subCodeBtn) subCodeBtn.addEventListener('click', async function(){
    var email=document.getElementById('verify-email').value;
    var code=document.getElementById('verify-code').value;
    var r=await fetch('/api/v1/secrets/'+id+'/verify', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email: email, code: code }) });
    var j=await r.json().catch(function(){ return {}; });
    if(r.ok && j.verify_token){
      // Retry open with the verification token.
      sessionStorage.setItem('ottl_vt_'+id, j.verify_token);
      hide('verify'); show('reveal-panel');
    } else {
      var msg=document.getElementById('verify-msg');
      if(msg) msg.textContent = j.message || 'That code did not match. Try again.';
    }
  });

})();
