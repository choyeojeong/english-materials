import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useState } from 'react'

function LevelBlock({ level, parents, onRefresh }) {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [order, setOrder] = useState(0)
  const [editing, setEditing] = useState(null)
  const [loading,setLoading] = useState(false)

  const load = async ()=>{
    const q = query(collection(db,'categories'), where('level','==',level), orderBy('order','asc'))
    const snap = await getDocs(q)
    setItems(snap.docs.map(d=>({id:d.id, ...d.data()})))
  }

  useEffect(()=>{ load() },[level])

  const reset = ()=>{ setName(''); setParentId(''); setOrder(0); setEditing(null) }

  const save = async ()=>{
    if(!name.trim()) return
    setLoading(true)
    if(editing){
      await updateDoc(doc(db,'categories', editing), {
        name, order: Number(order)||0, parentId: parentId||null
      })
    }else{
      await addDoc(collection(db,'categories'), {
        name, level, order: Number(order)||0, parentId: parentId||null, createdAt: new Date()
      })
    }
    reset()
    await load()
    onRefresh?.()
    setLoading(false)
  }

  const del = async (id)=>{
    // 사용 중인지 검사 (materials 참조 여부)
    const c1 = await getCountFromServer(query(collection(db,'materials'), where(level==='L'?'largeCategoryId':level==='M'?'mediumCategoryId':'smallCategoryId','==', id)))
    if(c1.data().count>0){ alert('이 분류를 사용하는 항목이 있어 삭제할 수 없습니다.'); return }
    await deleteDoc(doc(db,'categories', id))
    await load()
    onRefresh?.()
  }

  return (
    <div className="card">
      <h3 className="title">{level==='L'?'대분류':level==='M'?'중분류':'소분류'}</h3>
      <div className="row">
        {level!=='L' &&
          <div className="col">
            <label>상위 분류</label>
            <select value={parentId} onChange={e=>setParentId(e.target.value)}>
              <option value="">(선택)</option>
              {parents.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        }
        <div className="col">
          <label>이름</label>
          <input value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className="col">
          <label>정렬 order</label>
          <input type="number" value={order} onChange={e=>setOrder(e.target.value)} />
        </div>
        <div className="col" style={{alignSelf:'end'}}>
          <button onClick={save} disabled={loading}>{editing?'수정 저장':'추가'}</button>
          <button className="secondary" onClick={reset} style={{marginLeft:8}}>리셋</button>
        </div>
      </div>
      <table style={{marginTop:12}}>
        <thead><tr><th>이름</th><th>상위</th><th>order</th><th>작업</th></tr></thead>
        <tbody>
          {items.map(it=>(
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.parentId ? (parents.find(p=>p.id===it.parentId)?.name || '-') : '-'}</td>
              <td>{it.order}</td>
              <td className="toolbar">
                <button className="secondary" onClick={()=>{
                  setEditing(it.id); setName(it.name); setOrder(it.order||0); setParentId(it.parentId||'')
                }}>수정</button>
                <button className="danger" onClick={()=>del(it.id)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Categories(){
  const [L, setL] = useState([])
  const [M, setM] = useState([])

  const refreshParents = async ()=>{
    const Lsnap = await getDocs(query(collection(db,'categories'), where('level','==','L'), orderBy('order','asc')))
    const Msnap = await getDocs(query(collection(db,'categories'), where('level','==','M'), orderBy('order','asc')))
    setL(Lsnap.docs.map(d=>({id:d.id, ...d.data()})))
    setM(Msnap.docs.map(d=>({id:d.id, ...d.data()})))
  }

  useEffect(()=>{ refreshParents() },[])

  return (
    <>
      <div className="card">
        <h2 className="title">분류 관리</h2>
        <p>대·중·소 분류를 자유롭게 만들고 삭제하세요. (사용 중인 분류는 삭제 불가)</p>
      </div>
      <LevelBlock level="L" parents={[]} onRefresh={refreshParents}/>
      <LevelBlock level="M" parents={L} onRefresh={refreshParents}/>
      <LevelBlock level="S" parents={M} onRefresh={refreshParents}/>
    </>
  )
}
