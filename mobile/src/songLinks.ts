export function songLink(id:string):string {
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('This song does not have a shareable catalog link.');
  return 'cinemusic://song/'+id;
}
