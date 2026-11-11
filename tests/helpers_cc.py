# reference only: JS for picking a date in react-day-picker popover
PICK_JS = """
async ([y, m, d]) => {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const target = months[m] + ' ' + y;
  for (let i = 0; i < 24; i++) {
    const cap = Array.from(document.querySelectorAll('[role=presentation], .rdp-caption_label, div')).find(e => e.childElementCount===0 && /^(January|February|March|April|May|June|July|August|September|October|November|December) \\d{4}$/.test(e.textContent.trim()));
    if (!cap) return 'nocap';
    if (cap.textContent.trim() === target) break;
    const prev = document.querySelector('button[name=previous-month]');
    prev.click();
    await new Promise(r => setTimeout(r, 200));
  }
  const btns = Array.from(document.querySelectorAll('button[name=day]')).filter(b => b.textContent.trim() === String(d) && !b.className.includes('text-slate-600') && !b.disabled);
  if (!btns.length) return 'noday';
  btns[0].click();
  return 'ok';
}
"""
