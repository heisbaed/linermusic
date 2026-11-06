export interface SwipePoint { x:number; y:number; at:number }
export function swipeDirection(start:SwipePoint,end:SwipePoint):'up'|'down'|'left'|'right'|null {
  const x=end.x-start.x,y=end.y-start.y;
  if(end.at-start.at>900||Math.max(Math.abs(x),Math.abs(y))<60)return null;
  if(Math.abs(x)>Math.abs(y)*1.25)return x<0?'left':'right';
  if(Math.abs(y)>Math.abs(x)*1.25)return y<0?'up':'down';
  return null;
}
