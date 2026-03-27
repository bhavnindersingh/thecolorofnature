import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Newsletter from './components/Newsletter'
import Footer from './components/Footer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Cart from './pages/Cart'
import Account from './pages/Account'
import ProductDetail from './pages/ProductDetail'
import Checkout from './pages/Checkout'
import ResetPassword from './pages/ResetPassword'
import About from './pages/About'
import Partnerships from './pages/Partnerships'
import Contact from './pages/Contact'
import ShippingPayments from './pages/ShippingPayments'
import Terms from './pages/Terms'
import Returns from './pages/Returns'
import Process from './pages/Process'
import Privacy from './pages/Privacy'
import AdminSync from './pages/AdminSync'
import './index.css'

const queryClient = new QueryClient()

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/account" element={<Account />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/partnerships" element={<Partnerships />} />
            <Route path="/process" element={<Process />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/shipping" element={<ShippingPayments />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<AdminSync />} />
          </Routes>
          <Newsletter />
          <Footer />
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  )
}
