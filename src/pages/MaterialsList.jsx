import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export default function MaterialsList(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [qText, setQText] = useState('')
  const [large, setLarge] = useState('')
  const [medium, setMedium] = useState('')
  const [small, setSmall] = useState('')

  const [L, setL] = useState([])
  const [M, setM] = useState([])
  const [S, setS] = useState([])

  useEffect(()=>{
    const run = async ()=>{
      const Lsnap = await getDocs(query(collection(db,'categories'), where('level','==','L'), orderBy('order','asc')))
      setL(Lsnap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[])

  useEffect(()=>{
    const run = async ()=>{
      if(!large){ setM([]); return }
      const Msnap = await getDocs(query(collection(db,'categories'), where('level','==','M'), where('parentId','==',large), orderBy('order','asc')))
      setM(Msnap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[large])

  useEffect(()=>{
    const run = async ()=>{
      if(!medium){ setS([]); return }
      const Ssnap = await getDocs(query(collection(db,'categories'), where('level','==','S'), where('parentId','==',medium), orderBy('order','asc')))
      setS(Ssnap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[medium])

  const load = async ()=>{
    setLoading(true)
    let q = query(collection(db,'materials'), orderBy('createdAt','desc'))
    const clauses = []
    if(type) clauses.push(where('type','==', type))
    if(difficulty) clauses.push(where('difficulty','==', difficulty))
    if(large) clauses.push(where('largeCategoryId','==', large))
    if(medium) clauses.push(where('mediumCategoryId','==', medium))
    if(small) clauses.push(where('smallCategoryId','==', small))
    if(clauses.length){
      // Firestore는 동적 where 결합 위해서 다시 q 구성
      q = query(collection(db,'materials'), ...clauses, orderBy('createdAt','desc'))
    }
    const snap = await getDocs(q)
    let arr = snap.docs.map(d=>({id:d.id, ...d.data()}))
    if(qText){
      const s = qText.toLowerCase()
      arr = arr.filter(it =>
        (it.text||'').toLowerCase().includes(s) ||
        (it.translationKo||'').toLowerCase().includes(s) ||
        (it.source?.text||'').toLowerCase().includes(s)
      )
    }
    setItems(arr)
    setLoading(false)
  }

  useEffect(()=>{ load() },[]) // 초기 로드

  const onDelete = async (id)=>{
    if(!confirm('정말 삭제할까요?')) return
    await deleteDoc(doc(db,'materials', id))
    await load()
  }

  const Lmap = useMemo(()=>Object.fromEntries(L.map(x=>[x.id,x.name])),[L])
  const Mmap = useMemo(()=>Object.fromEntries(M.map(x=>[x.id,x.name])),[M])
  const Smap = useMemo(()=>Object.fromEntries(S.map(x=>[x.id,x.name])),[S])

  return (
    <>
      <div className="card">
        <h2 className="title">문장/지문 목록</h2>
        <div className="toolbar" style={{marginBottom:10}}>
          <Link to="/materials/new"><button>+ 새 항목</button></Link>
          <button className="secondary" onClick={load} disabled={loading}>{loading?'불러오는 중..':'새로고침'}</button>
          <input placeholder="검색(영문/해석/출처)" value={qText} onChange={e=>setQText(e.target.value)} style={{flex:1}} />
        </div>
        <div className="row">
          <div className="col">
            <label>타입</label>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="">전체</option>
              <option value="sentence">문장</option>
              <option value="passage">지문</option>
            </select>
          </div>
          <div className="col">
            <label>난이도</label>
            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              <option value="">전체</option>
              <option value="A">A(쉬움)</option>
              <option value="B">B(중간)</option>
              <option value="C">C(어려움)</option>
            </select>
          </div>
          <div className="col">
            <label>대분류</label>
            <select value={large} onChange={e=>{ setLarge(e.target.value); setMedium(''); setSmall(''); }}>
              <option value="">전체</option>
              {L.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="col">
            <label>중분류</label>
            <select value={medium} onChange={e=>{ setMedium(e.target.value); setSmall(''); }} disabled={!large}>
              <option value="">전체</option>
              {M.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="col">
            <label>소분류</label>
            <select value={small} onChange={e=>setSmall(e.target.value)} disabled={!medium}>
              <option value="">전체</option>
              {S.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="col" style={{alignSelf:'end'}}>
            <button onClick={load}>필터 적용</button>
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{width:80}}>타입</th>
              <th>영문</th>
              <th>한국어 해석</th>
              <th style={{width:140}}>난이도</th>
              <th style={{width:220}}>분류</th>
              <th style={{width:160}}>출처</th>
              <th style={{width:180}}>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id}>
                <td><span className="badge">{it.type}</span></td>
                <td style={{maxWidth:380, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.text}>{it.text}</td>
                <td style={{maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.translationKo}>{it.translationKo}</td>
                <td>{it.difficulty||'-'}</td>
                <td>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {it.largeCategoryId && <span className="badge">{Lmap[it.largeCategoryId]||'?'}</span>}
                    {it.mediumCategoryId && <span className="badge">{Mmap[it.mediumCategoryId]||'?'}</span>}
                    {it.smallCategoryId && <span className="badge">{Smap[it.smallCategoryId]||'?'}</span>}
                  </div>
                </td>
                <td>{it.source?.text || '-'}</td>
                <td className="toolbar">
                  <Link to={`/materials/${it.id}`}><button className="secondary">수정</button></Link>
                  <button className="danger" onClick={()=>onDelete(it.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} style={{textAlign:'center', color:'#777'}}>데이터가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
