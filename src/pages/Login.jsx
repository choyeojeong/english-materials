import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'   // ✅ 추가: Firebase auth 인스턴스

export default function Login(){
  const nav = useNavigate()
  const [id, setId] = useState('rabbit@naver.com')   // 공유 아이디
  const [pw, setPw] = useState('rabbithabit')        // 공유 비번
  const [err, setErr] = useState('')

  const onSubmit = async (e)=>{
    e.preventDefault()
    try{
      // ✅ Firebase 실제 로그인
      await signInWithEmailAndPassword(auth, id, pw)
      nav('/')
    }catch(error){
      setErr(error.message || '로그인 실패')
    }
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'60px auto'}}>
        <h2 className="title">로그인</h2>
        <form onSubmit={onSubmit}>
          <label>아이디(이메일)</label>
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
