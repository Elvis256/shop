/**
 * Export all schema components
 * Makes it easy to import schema components in pages
 */

export { default as OrganizationSchema } from './OrganizationSchema';
export { default as Breadcrumb, generateProductBreadcrumbs, generateCategoryBreadcrumbs, generateBlogBreadcrumbs } from './BreadcrumbSchema';
export { default as ArticleSchema, FAQSchema } from './ArticleSchema';
export { default as ProductSchema, ReviewSchema } from './ProductSchema';
