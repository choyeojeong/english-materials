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

  // 대분류 로드
  useEffect(()=>{
    const run = async ()=>{
      const snap = await getDocs(
        query(collection(db,'categories'), where('level','==','L'), orderBy('order','asc'))
      )
      setL(snap.docs.map(d=>({id:d.id, ...d.data()})))
    }
    run()
  },[])

  // 선택된 대분류의 중분류 로드
  useEffect(()=>{
    const run = async ()=>{
      if(!largeCategoryId){
        setM([])
        // 대분류 해제되면 중/소분류도 초기화
        if(mediumCategoryId) onChange({ level:'M', id:null })
        if(smallCategoryId) onChange({ level:'S', id:null })
        return
      }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','M'),
        where('parentId','==', largeCategoryId),
        orderBy('order','asc')
      ))
      const arr = snap.docs.map(d=>({id:d.id, ...d.data()}))
      setM(arr)

      // 현재 선택된 중분류가 이 대분류에 속하지 않으면 초기화
      if(mediumCategoryId && !arr.some(x=>x.id===mediumCategoryId)){
        onChange({ level:'M', id:null })
      }
      // 소분류도 함께 초기화
      if(smallCategoryId){
        onChange({ level:'S', id:null })
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[largeCategoryId])

  // 선택된 중분류의 소분류 로드
  useEffect(()=>{
    const run = async ()=>{
      if(!mediumCategoryId){
        setS([])
        if(smallCategoryId) onChange({ level:'S', id:null })
        return
      }
      const snap = await getDocs(query(
        collection(db,'categories'),
        where('level','==','S'),
        where('parentId','==', mediumCategoryId),
        orderBy('order','asc')
      ))
      const arr = snap.docs.map(d=>({id:d.id, ...d.data()}))
      setS(arr)

      // 소분류가 아예 없으면 선택값 강제로 null (UI도 숨김)
      if(arr.length === 0 && smallCategoryId){
        onChange({ level:'S', id:null })
      }
      // 선택된 소분류가 현재 목록에 없다면 초기화
      if(arr.length > 0 && smallCategoryId && !arr.some(x=>x.id===smallCategoryId)){
        onChange({ level:'S', id:null })
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mediumCategoryId])

  const hasMedium = !!largeCategoryId
  const hasSmallList = S.length > 0   // 소분류 유무에 따라 소분류 셀렉트 숨김/표시

  return (
    <div className="row">
      {/* 대분류 */}
      <div className="col">
        <label>대분류</label>
        <select
          value={largeCategoryId||''}
          onChange={e=>{
            const v = e.target.value || null
            onChange({ level:'L', id:v })
            // 대분류 변경 시 하위 단계 초기화는 effect에서 처리
          }}
        >
          <option value="">(선택 없음)</option>
          {L.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 중분류 */}
      <div className="col">
        <label>중분류</label>
        <select
          value={mediumCategoryId||''}
          onChange={e=>{
            const v = e.target.value || null
            onChange({ level:'M', id:v })
            // 중분류 변경 시 소분류 초기화는 effect에서 처리
          }}
          disabled={!hasMedium}
        >
          <option value="">(선택 없음)</option>
          {M.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* 중분류만 있고 소분류가 하나도 없는 경우 안내 (선택) */}
        {hasMedium && mediumCategoryId && !hasSmallList && (
          <div style={{fontSize:12, color:'#6b7280', marginTop:6}}>
            이 중분류에는 소분류가 없습니다. 중분류까지만 선택해도 저장돼요.
          </div>
        )}
      </div>

      {/* 소분류: 목록이 있을 때만 렌더 */}
      {hasSmallList && (
        <div className="col">
          <label>소분류</label>
          <select
            value={smallCategoryId||''}
            onChange={e=>onChange({level:'S', id:e.target.value||null})}
            disabled={!mediumCategoryId}
          >
            <option value="">(선택 없음)</option>
            {S.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
