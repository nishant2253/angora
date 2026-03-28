// Tell TypeScript that CSS files are valid imports (side-effect and module)
declare module '*.css' {
  const content: { readonly [className: string]: string }
  export default content
}
