import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const onSubmit = async (e)=>{
    e.preventDefault()
    try{
      await signInWithEmailAndPassword(auth, email, pw)
      nav('/')
    }catch(error){
      setErr(error.message)
    }
  }
  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'60px auto'}}>
        <h2 className="title">영어교재 CMS 로그인</h2>
        <form onSubmit={onSubmit}>
          <label>이메일</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" />
          <label style={{marginTop:12}}>비밀번호</label>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} />
          {err && <div style={{color:'#d9534f', marginTop:8}}>{err}</div>}
          <button style={{marginTop:14, width:'100%'}}>로그인</button>
        </form>
        <p style={{fontSize:12, color:'#777', marginTop:12}}>※ Firebase 콘솔에서 이메일/비밀번호 사용자 계정을 먼저 생성하세요.</p>
      </div>
    </div>
  )
}
