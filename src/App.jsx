// src/App.jsx
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Categories from './pages/Categories.jsx'
import MaterialsList from './pages/MaterialsList.jsx'
import EditMaterial from './pages/EditMaterial.jsx'
import CategoryMaterials from './pages/CategoryMaterials.jsx' // ✅ 추가

function Shell({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(()=>{
    // 로그인 상태 구독
    const unsub = onAuthStateChanged(auth, (u)=>{
      setUser(u)
      setReady(true)
      if(!u) navigate('/login', { replace:true })
    })
    return () => unsub()
  }, [navigate])

  if(!ready) return null      // 초기 로딩 중
  if(!user) return null       // 로그인 안 됨 → /login 으로 리다이렉트됨

  return (
    <div className="container">
      <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div className="nav">
          <Link to="/">대시보드</Link>
          <Link to="/materials">문장/지문</Link>
          <Link to="/categories">분류관리</Link>
          <Link to="/by-category">분류별 보기</Link> {/* ✅ 추가 */}
        </div>
        <div className="toolbar">
          <span className="badge">{user.email}</span>
          <button
            className="secondary"
            onClick={async ()=>{
              await signOut(auth)
              navigate('/login')
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Shell><Dashboard/></Shell>} />
      <Route path="/materials" element={<Shell><MaterialsList/></Shell>} />
      <Route path="/materials/new" element={<Shell><EditMaterial/></Shell>} />
      <Route path="/materials/:id" element={<Shell><EditMaterial/></Shell>} />
      <Route path="/categories" element={<Shell><Categories/></Shell>} />
      <Route path="/by-category" element={<Shell><CategoryMaterials/></Shell>} /> {/* ✅ 추가 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
