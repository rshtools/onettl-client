
export function copyFrom(inp, btn){
  // Works for inputs/textareas (.value + select) and plain blocks like <pre> (textContent + Range).
  var text = (inp.value !== undefined && inp.value !== null) ? inp.value : (inp.textContent || '');
  try {
    if(typeof inp.select === 'function'){ inp.focus(); inp.select(); if(inp.setSelectionRange) inp.setSelectionRange(0, 99999); }
    else if(window.getSelection && document.createRange){ var r=document.createRange(); r.selectNodeContents(inp); var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  } catch(e){}
  var orig=btn.getAttribute('data-label');
  if(orig===null){ orig=btn.textContent; btn.setAttribute('data-label', orig); }
  var done=function(){
    btn.classList.add('copied'); btn.textContent='✓';
    setTimeout(function(){ btn.classList.remove('copied'); btn.textContent=orig; }, 1500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, function(){ try{ document.execCommand('copy'); done(); }catch(e){} });
  } else { try{ document.execCommand('copy'); done(); }catch(e){} }
}
