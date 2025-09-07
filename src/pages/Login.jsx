import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const nav = useNavigate()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const onSubmit = (e)=>{
    e.preventDefault()
    // 고정 아이디/비밀번호 체크
    if(id === 'rabbit@naver.com' && pw === 'rabbithabit'){
      // 로그인 성공 → localStorage에 토큰 저장
      localStorage.setItem('loggedIn', 'true')
      nav('/')
    } else {
      setErr('아이디 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'60px auto'}}>
        <h2 className="title">로그인</h2>
        <form onSubmit={onSubmit}>
          <label>아이디</label>
          <input value={id} onChange={e=>setId(e.target.value)} />
          <label style={{marginTop:12}}>비밀번호</label>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} />
          {err && <div style={{color:'#d9534f', marginTop:8}}>{err}</div>}
          <button style={{marginTop:14, width:'100%'}}>로그인</button>
        </form>
      </div>
    </div>
  )
}
