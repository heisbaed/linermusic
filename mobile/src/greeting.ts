export function homeGreeting(hour: number): string {
  if(hour<5||hour>=22)return 'Welcome back';
  if(hour<12)return 'Good morning';
  if(hour<17)return 'Good afternoon';
  return 'Good evening';
}
