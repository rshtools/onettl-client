
import { encryptSecret } from './crypto.js';
import { copyFrom } from './dom.js';

(function(){
  var form=document.getElementById('form');
  if(!form) return;
  var errEl=document.getElementById('error');
  var secretEl=document.getElementById('secret');
  var typeText=document.getElementById('type-text');
  var typeJson=document.getElementById('type-json');
  var secretType='text';

  function show(el){ if(el) el.hidden=false; }
  function hide(el){ if(el) el.hidden=true; }
  function fmtTtl(s){
    s=parseInt(s,10);
    if(s>=86400){ var d=s/86400; return d+' day'+(d>1?'s':''); }
    if(s>=3600){ var h=s/3600; return h+' hour'+(h>1?'s':''); }
    if(s>=60){ var m=s/60; return m+' minute'+(m>1?'s':''); }
    return s+' seconds';
  }
  function setType(t){
    secretType=t;
    if(typeText) typeText.setAttribute('aria-pressed', t==='text'?'true':'false');
    if(typeJson) typeJson.setAttribute('aria-pressed', t==='json'?'true':'false');
  }
  if(typeText) typeText.addEventListener('click', function(){ setType('text'); });
  if(typeJson) typeJson.addEventListener('click', function(){ setType('json'); });

  // Keep the receipt facts in sync with the composer before a link exists.
  function opensLabel(n){ return n>1 ? (n+' opens') : '1 open'; }
  function syncFacts(){
    var ttlSel=document.getElementById('ttl');
    var opensEl=document.getElementById('opens');
    var n=opensEl ? (parseInt(opensEl.value,10)||1) : 1;
    var fo=document.getElementById('factOpens'); if(fo) fo.textContent=opensLabel(n);
    var ft=document.getElementById('factTtl'); if(ft && ttlSel) ft.textContent=fmtTtl(ttlSel.value);
    var note=document.getElementById('composer-facts');
    if(note && ttlSel){ note.textContent='Expires in '+fmtTtl(ttlSel.value)+' · '+opensLabel(n); }
  }
  var ttlSel=document.getElementById('ttl'); if(ttlSel) ttlSel.addEventListener('change', syncFacts);
  var opensEl0=document.getElementById('opens'); if(opensEl0) opensEl0.addEventListener('change', syncFacts);
  syncFacts();

  // Generate a random 6-letter passphrase (readable set, no l/o to avoid confusion).
  function randomPassphrase(){
    var chars='abcdefghijkmnpqrstuvwxyz';
    var a=crypto.getRandomValues(new Uint8Array(6));
    var s='';
    for(var i=0;i<6;i++){ s+=chars.charAt(a[i]%chars.length); }
    return s;
  }
  var genBtn=document.getElementById('genpass');
  if(genBtn) genBtn.addEventListener('click', function(){
    var p=document.getElementById('passphrase');
    if(p){ p.value=randomPassphrase(); p.focus(); }
  });

  // More options disclosure (Opens / Passphrase).
  var moreBtn=document.getElementById('more-toggle'), moreOpts=document.getElementById('more-opts');
  if(moreBtn && moreOpts) moreBtn.addEventListener('click', function(){
    var opening=moreOpts.hidden;
    moreOpts.hidden=!opening;
    moreBtn.setAttribute('aria-expanded', opening?'true':'false');
    moreBtn.textContent = opening ? '− Options' : '+ Options';
  });

  // Auto-grow the composer: starts at its compact min-height and expands with
  // content (capped at half the viewport so it never hides the keyboard/CTA).
  function autogrow(){
    if(!secretEl) return;
    secretEl.style.height='auto';
    secretEl.style.height=Math.min(secretEl.scrollHeight, Math.round(window.innerHeight*0.5))+'px';
  }
  if(secretEl){ secretEl.addEventListener('input', autogrow); }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    hide(errEl);
    var btn=document.getElementById('submit');
    btn.disabled=true; btn.textContent='Encrypting...';
    try {
      var secret=secretEl.value;
      if(!secret){ throw new Error('Enter a secret to share.'); }
      if(secretType==='json'){
        try { JSON.parse(secret); } catch(je){ throw new Error('That is not valid JSON. Switch to Text or fix the JSON.'); }
      }
      var ttl=parseInt(document.getElementById('ttl').value, 10);
      var opensEl=document.getElementById('opens');
      var opens=opensEl ? (parseInt(opensEl.value, 10) || 1) : 1;
      var passEl=document.getElementById('passphrase');
      var pass=passEl ? passEl.value : '';
      var labelEl=document.getElementById('label');
      var label=labelEl ? labelEl.value : '';

      var e=await encryptSecret(secret, pass || undefined);
      var protectedFlag=e.encryption_mode==='aesgcm_pbkdf2';

      var body={ ciphertext: e.ciphertext, encryption_mode: e.encryption_mode, ttl: ttl,
                 max_opens: opens, secret_type: secretType, passphraseProtected: protectedFlag };
      if(e.salt){ body.salt=e.salt; }
      if(label){ body.label=label; }

      btn.textContent='Creating link...';
      var res=await fetch('/api/v1/secrets', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){
        var j=await res.json().catch(function(){ return {}; });
        if(res.status===429){ throw new Error(j.message || 'Too many secrets created just now. Wait a minute and try again.'); }
        if(res.status===413){ throw new Error('That secret is too large for the Free tier (25 KB max).'); }
        throw new Error(j.message || j.error || ('HTTP '+res.status));
      }
      var data=await res.json();
      var base = data.url || (location.origin + '/s/' + data.id);
      var link = base + '#k=' + e.keyFragment;

      // Collapse the composer and show only the result.
      hide(form);
      show(document.getElementById('receipt'));
      var linkEl=document.getElementById('link');
      linkEl.textContent=link;
      if(protectedFlag){
        document.getElementById('passOut').textContent = pass;
        show(document.getElementById('passRow'));
      } else {
        hide(document.getElementById('passRow'));
      }
      linkEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch(err){
      errEl.textContent = (err && err.message) ? err.message : 'Could not create link.';
      show(errEl);
    } finally {
      btn.disabled=false; btn.textContent='Create link';
    }
  });

  var copyBtn=document.getElementById('copy');
  if(copyBtn) copyBtn.addEventListener('click', function(){ copyFrom(document.getElementById('link'), this); });
  var copyPass=document.getElementById('copyPass');
  if(copyPass) copyPass.addEventListener('click', function(){ copyFrom(document.getElementById('passOut'), this); });
  var again=document.getElementById('again');
  if(again) again.addEventListener('click', function(){ location.reload(); });
})();
