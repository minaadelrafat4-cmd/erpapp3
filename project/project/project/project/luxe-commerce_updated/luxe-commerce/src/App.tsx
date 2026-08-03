import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ToastProvider } from '@/context/ToastContext';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import PermissionRoute from '@/components/auth/PermissionRoute';
import { Spinner } from '@/components/ui/Card';

// Storefront pages — lazy loaded for code splitting
const Home = lazy(() => import('@/pages/storefront/Home'));
const Shop = lazy(() => import('@/pages/storefront/Shop'));
const Categories = lazy(() => import('@/pages/storefront/Categories'));
const Brands = lazy(() => import('@/pages/storefront/Brands'));
const ProductDetails = lazy(() => import('@/pages/storefront/ProductDetails'));
const Search = lazy(() => import('@/pages/storefront/Search'));
const Wishlist = lazy(() => import('@/pages/storefront/Wishlist'));
const Cart = lazy(() => import('@/pages/storefront/Cart'));
const Checkout = lazy(() => import('@/pages/storefront/Checkout'));
const Account = lazy(() => import('@/pages/storefront/Account'));
const OrderTracking = lazy(() => import('@/pages/storefront/OrderTracking'));
const Blog = lazy(() => import('@/pages/storefront/Blog').then(m => ({ default: m.Blog })));
const BlogPost = lazy(() => import('@/pages/storefront/Blog').then(m => ({ default: m.BlogPost })));
const Contact = lazy(() => import('@/pages/storefront/Contact'));
const About = lazy(() => import('@/pages/storefront/About'));
const FAQ = lazy(() => import('@/pages/storefront/FAQ'));
const StoreLocator = lazy(() => import('@/pages/storefront/StoreLocator'));
const Careers = lazy(() => import('@/pages/storefront/Careers'));
const SignIn = lazy(() => import('@/pages/storefront/Auth').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('@/pages/storefront/Auth').then(m => ({ default: m.SignUp })));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const Legal = lazy(() => import('@/pages/storefront/Legal').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('@/pages/storefront/Legal').then(m => ({ default: m.Terms })));
const Cookies = lazy(() => import('@/pages/storefront/Legal').then(m => ({ default: m.Cookies })));
const NotFound = lazy(() => import('@/pages/storefront/NotFound'));

// Admin pages — lazy loaded
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminReturnsRefunds = lazy(() => import('@/pages/admin/AdminReturnsRefunds'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'));
const AdminBranches = lazy(() => import('@/pages/admin/AdminBranches'));
const AdminEmployees = lazy(() => import('@/pages/admin/AdminEmployees'));
const AdminSuppliers = lazy(() => import('@/pages/admin/AdminSuppliers'));
const AdminWarehouses = lazy(() => import('@/pages/admin/AdminWarehouses'));
const AdminPurchaseOrders = lazy(() => import('@/pages/admin/AdminPurchaseOrders'));
const AdminStockTransfers = lazy(() => import('@/pages/admin/AdminStockTransfers'));
const AdminInventoryTimeline = lazy(() => import('@/pages/admin/AdminInventoryTimeline'));
const AdminCycleCounts = lazy(() => import('@/pages/admin/AdminCycleCounts'));
const AdminReorderSuggestions = lazy(() => import('@/pages/admin/AdminReorderSuggestions'));
const AdminInventoryReservations = lazy(() => import('@/pages/admin/AdminInventoryReservations'));
const AdminSecurity = lazy(() => import('@/pages/admin/AdminSecurity'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminContent = lazy(() => import('@/pages/admin/AdminContent'));
const AdminRoles = lazy(() => import('@/pages/admin/AdminRoles'));
const AdminPermissions = lazy(() => import('@/pages/admin/AdminPermissions'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Spinner />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <WishlistProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Storefront */}
                  <Route element={<StorefrontLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/brands" element={<Brands />} />
                    <Route path="/brands/:slug" element={<Brands />} />
                    <Route path="/product/:slug" element={<ProductDetails />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/track-order" element={<OrderTracking />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/store-locator" element={<StoreLocator />} />
                    <Route path="/careers" element={<Careers />} />
                    <Route path="/privacy" element={<Legal />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/cookies" element={<Cookies />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  {/* Customer Auth (no storefront layout) */}
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/login" element={<SignIn />} />
                  <Route path="/signup" element={<SignUp />} />

                  {/* Employee/Admin Auth (no storefront layout) */}
                  <Route path="/admin/login" element={<AdminLogin />} />

                  {/* Admin (protected — staff only) */}
                  <Route path="/admin" element={<ProtectedRoute requireStaff><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<PermissionRoute permission="dashboard.view"><AdminDashboard /></PermissionRoute>} />
                    <Route path="orders" element={<PermissionRoute permission="orders.manage"><AdminOrders /></PermissionRoute>} />
                    <Route path="returns-refunds" element={<PermissionRoute permission="returns_refunds.manage"><AdminReturnsRefunds /></PermissionRoute>} />
                    <Route path="products" element={<PermissionRoute permission="products.manage"><AdminProducts /></PermissionRoute>} />
                    <Route path="categories" element={<PermissionRoute permission="categories.manage"><AdminCategories /></PermissionRoute>} />
                    <Route path="customers" element={<PermissionRoute permission="customers.manage"><AdminCustomers /></PermissionRoute>} />
                    <Route path="inventory" element={<PermissionRoute permission="inventory.valuation"><AdminInventory /></PermissionRoute>} />
                    <Route path="inventory-timeline" element={<PermissionRoute permission="inventory.valuation"><AdminInventoryTimeline /></PermissionRoute>} />
                    <Route path="stock-transfers" element={<PermissionRoute permission="inventory.transfer"><AdminStockTransfers /></PermissionRoute>} />
                    <Route path="cycle-counts" element={<PermissionRoute permission="inventory.valuation"><AdminCycleCounts /></PermissionRoute>} />
                    <Route path="reorder-suggestions" element={<PermissionRoute permission="inventory.valuation"><AdminReorderSuggestions /></PermissionRoute>} />
                    <Route path="inventory-reservations" element={<PermissionRoute permission="inventory.valuation"><AdminInventoryReservations /></PermissionRoute>} />
                    <Route path="security" element={<PermissionRoute permission="reports.financial"><AdminSecurity /></PermissionRoute>} />
                    <Route path="branches" element={<PermissionRoute permission="branches.manage"><AdminBranches /></PermissionRoute>} />
                    <Route path="warehouses" element={<PermissionRoute permission="warehouses.manage"><AdminWarehouses /></PermissionRoute>} />
                    <Route path="employees" element={<PermissionRoute permission="employees.manage"><AdminEmployees /></PermissionRoute>} />
                    <Route path="suppliers" element={<PermissionRoute permission="suppliers.manage"><AdminSuppliers /></PermissionRoute>} />
                    <Route path="purchase-orders" element={<PermissionRoute permission="purchase_orders.manage"><AdminPurchaseOrders /></PermissionRoute>} />
                    <Route path="reports" element={<PermissionRoute permission="reports.financial"><AdminReports /></PermissionRoute>} />
                    <Route path="analytics" element={<PermissionRoute permission="reports.financial"><AdminAnalytics /></PermissionRoute>} />
                    <Route path="notifications" element={<AdminNotifications />} />
                    <Route path="settings" element={<PermissionRoute permission="settings.manage"><AdminSettings /></PermissionRoute>} />
                    <Route path="content" element={<PermissionRoute permission="content.manage"><AdminContent /></PermissionRoute>} />
                    <Route path="roles" element={<PermissionRoute permission="roles.manage"><AdminRoles /></PermissionRoute>} />
                    <Route path="permissions" element={<PermissionRoute permission="permissions.manage"><AdminPermissions /></PermissionRoute>} />
                    <Route path="audit-logs" element={<PermissionRoute permission="audit_logs.view"><AdminAuditLogs /></PermissionRoute>} />
                  </Route>
                </Routes>
              </Suspense>
            </WishlistProvider>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}