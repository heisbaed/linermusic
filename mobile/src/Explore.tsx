import { useState } from 'react';
import { useApp } from './AppContext';
import { Cover,Notice,SearchField } from './ui';
import { Icon } from './Icons';
import { useDiscovery } from './discovery';

export function ExploreScreen(){
 const app=useApp();const {items,loading,error,retry}=useDiscovery(app.tab==='explore');
 const [query,setQuery]=useState('');const featured=items[1]||items[0];
 const open=(id:string)=>app.openRoute({kind:'catalog',type:'album',id});
 const search=()=>{if(!query.trim())return;app.goTab('search');window.dispatchEvent(new CustomEvent('cine:browse-search',{detail:{query:query.trim()}}));};
 return <section className="screen design-explore"><h1 className="page-title">Discover something<br/>new</h1>
  {featured&&<button className="discovery-feature" onClick={()=>open(featured.id)} aria-label={'Open '+featured.title}><Cover large song={{cover:featured.cover?.url}}/><span className="feature-kicker">ARTIST SPOTLIGHT</span><span className="feature-transport"><Icon name="arrow_right" size={22}/></span><span className="feature-title">{featured.title}</span><span className="feature-author">{featured.artists.map(a=>a.name).join(', ')}</span></button>}
  <div className="explore-search"><SearchField value={query} onChange={setQuery} onSubmit={search} placeholder="Find an artist or album" label="Explore music"/></div>
  {!!items.length&&<><div className="section-heading"><h2>Artist releases</h2></div><div className="discovery-release-grid">{items.filter(item=>item.id!==featured?.id).map(item=><button className="discovery-release" key={item.id} onClick={()=>open(item.id)}><Cover song={{cover:item.cover?.url}}/><strong>{item.title}</strong><small>{item.artists.map(a=>a.name).join(', ')}</small>{item.year&&<small>{item.year}</small>}</button>)}</div></>}
  {loading&&<p className="load-state" role="status"><span className="spinner"/>Finding artist releases...</p>}
  {(error||!app.online)&&<Notice title={app.online?'Explore could not connect':'You are offline'} icon="wifi" action={<button className="secondary-button" onClick={retry}>Try again</button>}>{error||'Your downloaded music is available in Library.'}</Notice>}
 </section>;
}
