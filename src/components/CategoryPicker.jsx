import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useState } from 'react'

export default function CategoryPicker({
  largeCategoryId, mediumCategoryId, smallCategoryId,
  onChange
}){
  const [L, setL] = useState([])
  const [M, setM] = useState([])
  const [S, setS] = useState([])

  useEffect(()=>{ // load L
    const run = async ()=>{
      const snap = await getDocs(query(collection(db,'categories'), where('level','==','L'), orderBy('order','asc')))
      setL(snap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[])

  useEffect(()=>{ // load M for selected L
    const run = async ()=>{
      if(!largeCategoryId){ setM([]); return }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','M'),
        where('parentId','==', largeCategoryId),
        orderBy('order','asc')
      ))
      setM(snap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[largeCategoryId])

  useEffect(()=>{ // load S for selected M
    const run = async ()=>{
      if(!mediumCategoryId){ setS([]); return }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','S'),
        where('parentId','==', mediumCategoryId),
        orderBy('order','asc')
      ))
      setS(snap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[mediumCategoryId])

  return (
    <div className="row">
      <div className="col">
        <label>대분류</label>
        <select value={largeCategoryId||''} onChange={e=>onChange({level:'L', id:e.target.value||null})}>
          <option value="">(선택 없음)</option>
          {L.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="col">
        <label>중분류</label>
        <select value={mediumCategoryId||''} onChange={e=>onChange({level:'M', id:e.target.value||null})} disabled={!largeCategoryId}>
          <option value="">(선택 없음)</option>
          {M.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="col">
        <label>소분류</label>
        <select value={smallCategoryId||''} onChange={e=>onChange({level:'S', id:e.target.value||null})} disabled={!mediumCategoryId}>
          <option value="">(선택 없음)</option>
          {S.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  )
}
