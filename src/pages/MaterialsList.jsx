import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export default function MaterialsList(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [qText, setQText] = useState('')
  const [large, setLarge] = useState('')
  const [medium, setMedium] = useState('')
  const [small, setSmall] = useState('')

  // 드롭다운용
  const [L, setL] = useState([])
  const [M, setM] = useState([])
  const [S, setS] = useState([])

  // 표시용(전역 맵)
  const [allL, setAllL] = useState([])
  const [allM, setAllM] = useState([])
  const [allS, setAllS] = useState([])

  // 대분류
  useEffect(()=>{
    (async ()=>{
      const snap = await getDocs(query(collection(db,'categories'), where('level','==','L'), orderBy('order','asc')))
      setL(snap.docs.map(d=>({id:d.id, ...d.data()})))
    })()
  },[])
  // 중분류
  useEffect(()=>{
    (async ()=>{
      if(!large){ setM([]); return }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','M'), where('parentId','==', large),
        orderBy('order','asc')
      ))
      setM(snap.docs.map(d=>({id:d.id, ...d.data()})))
    })()
  },[large])
  // 소분류
  useEffect(()=>{
    (async ()=>{
      if(!medium){ setS([]); return }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','S'), where('parentId','==', medium),
        orderBy('order','asc')
      ))
      setS(snap.docs.map(d=>({id:d.id, ...d.data()})))
    })()
  },[medium])

  // 전역 맵(표시용)
  useEffect(()=>{
    (async ()=>{
      const [Ls, Ms, Ss] = await Promise.all([
        getDocs(query(collection(db,'categories'), where('level','==','L'))),
        getDocs(query(collection(db,'categories'), where('level','==','M'))),
        getDocs(query(collection(db,'categories'), where('level','==','S')))
      ])
      setAllL(Ls.docs.map(d=>({id:d.id, ...d.data()})))
      setAllM(Ms.docs.map(d=>({id:d.id, ...d.data()})))
      setAllS(Ss.docs.map(d=>({id:d.id, ...d.data()})))
    })()
  },[])

  const load = async ()=>{
    setLoading(true)
    setError('')
    try{
      // 기본: 최신순(orderBy) – 필터 없을 때만 안전하게 사용
      let qRef = query(collection(db,'materials'), orderBy('createdAt','desc'))

      const clauses = []
      if(type) clauses.push(where('type','==', type))
      if(difficulty) clauses.push(where('difficulty','==', difficulty))
      if(large) clauses.push(where('largeIds','array-contains', large))
      if(medium) clauses.push(where('mediumIds','array-contains', medium))
      if(small) clauses.push(where('smallIds','array-contains', small))

      // ⚠️ 필터가 있으면 복합 인덱스가 필요해지는 경우가 많으므로
      // Firestore orderBy를 빼고, 가져온 뒤 클라이언트에서 정렬한다.
      if(clauses.length){
        qRef = query(collection(db,'materials'), ...clauses)
      }

      const snap = await getDocs(qRef)
      let arr = snap.docs.map(d=>({id:d.id, ...d.data()}))

      // 클라이언트 정렬(최신순)
      arr.sort((a,b)=>{
        const as = a.createdAt?.seconds ?? 0
        const bs = b.createdAt?.seconds ?? 0
        return bs - as
      })

      // 텍스트 검색
      if(qText){
        const s = qText.toLowerCase()
        arr = arr.filter(it =>
          (it.text||'').toLowerCase().includes(s) ||
          (it.translationKo||'').toLowerCase().includes(s) ||
          (it.source?.text||'').toLowerCase().includes(s)
        )
      }
      setItems(arr)
    }catch(e){
      console.error('[materials load error]', e)
      setError('목록을 불러오지 못했습니다. 필터 조합에 필요한 Firestore 인덱스가 없을 수 있어요.')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[]) // 초기 로딩

  const onDelete = async (id)=>{
    if(!confirm('정말 삭제할까요?')) return
    await deleteDoc(doc(db,'materials', id))
    await load()
  }

  const LmapAll = useMemo(()=>Object.fromEntries(allL.map(x=>[x.id,x.name])),[allL])
  const MmapAll = useMemo(()=>Object.fromEntries(allM.map(x=>[x.id,x.name])),[allM])
  const SmapAll = useMemo(()=>Object.fromEntries(allS.map(x=>[x.id,x.name])),[allS])

  const getPathsFor = (it)=>{
    if(Array.isArray(it.paths) && it.paths.length) return it.paths
    return [{
      largeId: it.largeCategoryId || null,
      mediumId: it.mediumCategoryId || null,
      smallId: it.smallCategoryId || null
    }].filter(p=>p.largeId || p.mediumId || p.smallId)
  }

  const renderPath = (p, idx) => {
    const chain = []
    if (p.largeId && LmapAll[p.largeId]) {
      chain.push(<span key="L" className="cat-chip cat-L">{LmapAll[p.largeId]}</span>)
    }
    if (p.mediumId && MmapAll[p.mediumId]) {
      if (chain.length) chain.push(<span key="sep1" className="cat-sep">›</span>)
      chain.push(<span key="M" className="cat-chip cat-M">{MmapAll[p.mediumId]}</span>)
    }
    if (p.smallId && SmapAll[p.smallId]) {
      if (chain.length) chain.push(<span key="sep2" className="cat-sep">›</span>)
      chain.push(<span key="S" className="cat-chip cat-S">{SmapAll[p.smallId]}</span>)
    }
    return (
      <div className="cat-path" key={idx}>
        {chain.length ? chain : <span className="cat-none">-</span>}
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h2 className="title">문장/지문 목록</h2>

        {/* 에러 안내 */}
        {error && (
          <div style={{background:'#fff3f3', border:'1px solid #ffd8d8', color:'#b00020', borderRadius:8, padding:'8px 12px', marginBottom:10}}>
            {error} (필요하면 인덱스 생성 링크 알려드릴게요!)
          </div>
        )}

        <div className="toolbar" style={{marginBottom:10, display:'flex', gap:8}}>
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
            <button onClick={load} disabled={loading}>필터 적용</button>
          </div>
        </div>
      </div>

      {/* ▼ 리스트: 2줄 카드형, 전체 텍스트 표시 */}
      <div className="card">
        <div className="materials-list">
          <div className="list-head">
            <span className="h-type">타입</span>
            <span className="h-eng-ko">영문 · 한국어 해석</span>
          </div>

          {items.map(it=>(
            <div key={it.id} className="material-card">
              <div className="row-top">
                <div className="type-badge">
                  <span className="badge">{it.type || '-'}</span>
                </div>
                <div className="eng-ko">
                  <div className="english">{it.text}</div>
                  <div className="korean">{it.translationKo}</div>
                </div>
              </div>

              <div className="row-bottom">
                <div className="meta meta-level">난이도: <b>{it.difficulty || '-'}</b></div>
                <div className="meta meta-cats">
                  <span className="muted">분류:</span>
                  <div className="cat-paths">
                    {getPathsFor(it).map(renderPath)}
                    {getPathsFor(it).length===0 && <span className="cat-none">-</span>}
                  </div>
                </div>
                <div className="meta meta-source">
                  <span className="muted">출처:</span>
                  <span className="source-text">{it.source?.text || '-'}</span>
                </div>
                <div className="actions">
                  <Link to={`/materials/${it.id}`}><button className="secondary">수정</button></Link>
                  <button className="danger" onClick={()=>onDelete(it.id)}>삭제</button>
                </div>
              </div>
            </div>
          ))}

          {!items.length && (
            <div className="empty">데이터가 없습니다.</div>
          )}
        </div>
      </div>
    </>
  )
}
