export async function initFooterLinks(){
 const root=document.querySelector('#footer-links');if(!root)return;
 try{const response=await fetch('/api/footer-links',{cache:'no-store'});if(!response.ok)return;const {links}=await response.json();root.replaceChildren();for(const [group,title]of [['support','Support'],['contact','Contact'],['social','Socials']]){
  const items=links.filter(link=>link.group===group);if(!items.length)continue;const section=document.createElement('div');section.className='footer-link-group';const heading=document.createElement('h3');heading.textContent=title;section.append(heading);for(const item of items){const anchor=document.createElement('a');anchor.textContent=item.label;anchor.href=item.url;if(item.newTab){anchor.target='_blank';anchor.rel='noopener noreferrer';}section.append(anchor);}root.append(section);
 }root.hidden=!root.childElementCount;}catch{/* A static preview can run without the backend. */}
}
