/** Public assets must resolve independently of the admin's nested browser route. */
export function demoAssetUrl(file: string) {
  return `${document.location.protocol === 'file:' ? './' : '/'}gig-demo-3d/${file}`;
}
