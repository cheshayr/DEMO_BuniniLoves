import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RequireAdmin, RequireAuth } from '@/components/RouteGuards'
import Home from '@/pages/Home'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Account from '@/pages/Account'
import Placeholder from '@/pages/Placeholder'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import Order from '@/pages/Order'
import Orders from '@/pages/Orders'
import Shop from '@/pages/Shop'
import Product from '@/pages/Product'
import { About, Contact, FAQ, Privacy, Returns, Shipping, Terms } from '@/pages/Info'

const News = lazy(() => import('@/pages/News'))
const NewsPost = lazy(() => import('@/pages/NewsPost'))
const Events = lazy(() => import('@/pages/Events'))
const EventDetail = lazy(() => import('@/pages/EventDetail'))
const Wishlist = lazy(() => import('@/pages/Wishlist'))
const MyReviews = lazy(() => import('@/pages/MyReviews'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminOverview = lazy(() => import('@/pages/admin/Overview'))
const AdminOrders = lazy(() => import('@/pages/admin/Orders'))
const AdminOrderDetail = lazy(() => import('@/pages/admin/OrderDetail'))
const AdminProducts = lazy(() => import('@/pages/admin/Products'))
const AdminProductEdit = lazy(() => import('@/pages/admin/ProductEdit'))
const AdminInventory = lazy(() => import('@/pages/admin/Inventory'))
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'))
const AdminDiscounts = lazy(() => import('@/pages/admin/Discounts'))
const AdminReviews = lazy(() => import('@/pages/admin/Reviews'))
const AdminCommunity = lazy(() => import('@/pages/admin/Community'))
const AdminShipping = lazy(() => import('@/pages/admin/Shipping'))

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center"><div className="skeleton h-10 w-40" /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="account/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="account/reviews" element={<RequireAuth><MyReviews /></RequireAuth>} />
          <Route path="wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
          <Route path="order/:id" element={<RequireAuth><Order /></RequireAuth>} />

          <Route path="shop" element={<Shop />} />
          <Route path="shop/:category" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="events" element={<Events />} />
          <Route path="events/:slug" element={<EventDetail />} />
          <Route path="news" element={<News />} />
          <Route path="news/:slug" element={<NewsPost />} />
          <Route path="about" element={<About />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="returns" element={<Returns />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<Placeholder title="Page not found" phase="never ♡" note="That page wandered off. Let's get you home." />} />
        </Route>

        <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminOverview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductEdit />} />
          <Route path="products/:id" element={<AdminProductEdit />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="community" element={<AdminCommunity />} />
          <Route path="shipping" element={<AdminShipping />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
