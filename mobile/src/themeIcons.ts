import type { Theme } from './AppContext';
export const themeIcons: Record<Theme,string> = {default:'rose',dark:'ivory',green:'forest',light:'mint'};
export const iconThemes: Record<string,Theme> = {rose:'default',ivory:'dark',forest:'green',mint:'light'};
export function syncThemeIcon(theme: Theme) {
  const native=window.CineAndroid, icon=themeIcons[theme];
  if(!native?.setAppIcon)return true;
  try{return native.appIcon?.()===icon||native.setAppIcon(icon);}catch{return false;}
}
