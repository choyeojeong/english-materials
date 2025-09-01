// App.jsx 일부 수정
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Categories from './pages/Categories.jsx'
import MaterialsList from './pages/MaterialsList.jsx'
import EditMaterial from './pages/EditMaterial.jsx'

function Shell({ children }) {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(()=>{
    const ok = localStorage.getItem('loggedIn') === 'true'
    if(!ok) navigate('/login')
    setLoggedIn(ok)
  }, [navigate])

  if(!loggedIn) return null

  return (
    <div className="container">
      <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div className="nav">
          <Link to="/">대시보드</Link>
          <Link to="/materials">문장/지문</Link>
          <Link to="/categories">분류관리</Link>
        </div>
        <div className="toolbar">
          <button className="secondary" onClick={()=>{
            localStorage.removeItem('loggedIn')
            navigate('/login')
          }}>로그아웃</button>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
