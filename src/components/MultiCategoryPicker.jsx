import { useEffect } from 'react'
import CategoryPicker from './CategoryPicker'

/**
 * props:
 *  paths: Array<{ largeId: string|null, mediumId: string|null, smallId: string|null }>
 *  onChange(newPaths)
 */
export default function MultiCategoryPicker({ paths, onChange }) {
  useEffect(()=>{
    if(!paths || !Array.isArray(paths) || paths.length===0){
      onChange([{ largeId:null, mediumId:null, smallId:null }])
    }
    // eslint-disable-next-line
  },[])

  const updatePath = (idx, level, id) => {
    const next = [...paths]
    const cur = { ...(next[idx] || {largeId:null,mediumId:null,smallId:null}) }
    if(level==='L'){ cur.largeId = id; cur.mediumId=null; cur.smallId=null }
    if(level==='M'){ cur.mediumId = id; cur.smallId=null }
    if(level==='S'){ cur.smallId = id }
    next[idx] = cur
    onChange(next)
  }

  const addPath = () => {
    onChange([...(paths||[]), { largeId:null, mediumId:null, smallId:null }])
  }

  const removePath = (idx) => {
    const next = [...paths]
    next.splice(idx,1)
    onChange(next.length ? next : [{ largeId:null, mediumId:null, smallId:null }])
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {(paths||[]).map((p, i)=>(
        <div key={i} className="card" style={{padding:12}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <b>분류 경로 #{i+1}</b>
            <div className="toolbar">
              <button className="danger" onClick={()=>removePath(i)} disabled={(paths||[]).length<=1}>삭제</button>
            </div>
          </div>
          <CategoryPicker
            largeCategoryId={p.largeId}
            mediumCategoryId={p.mediumId}
            smallCategoryId={p.smallId}
            onChange={({level, id})=>updatePath(i, level, id)}
          />
        </div>
      ))}
      <div className="toolbar">
        <button onClick={addPath}>+ 대분류 경로 추가</button>
      </div>
    </div>
  )
}
