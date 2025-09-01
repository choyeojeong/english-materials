import { addDoc, collection, doc, getDocs, getDoc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CategoryPicker from '../components/CategoryPicker.jsx'

export default function EditMaterial(){
  const nav = useNavigate()
  const { id } = useParams()
  const isNew = !id
  const [type, setType] = useState('sentence')
  const [text, setText] = useState('')
  const [translationKo, setTranslationKo] = useState('')
  const [difficulty, setDifficulty] = useState('B')
  const [sourceText, setSourceText] = useState('') // "2021 고3 6월 모평 18번" 같은 자유 입력
  const [tags, setTags] = useState('') // 콤마 구분

  const [largeCategoryId, setLargeCategoryId] = useState(null)
  const [mediumCategoryId, setMediumCategoryId] = useState(null)
  const [smallCategoryId, setSmallCategoryId] = useState(null)

  const load = async ()=>{
    if(!id) return
    const snap = await getDoc(doc(db,'materials', id))
    const d = snap.data()
    setType(d.type||'sentence')
    setText(d.text||'')
    setTranslationKo(d.translationKo||'')
    setDifficulty(d.difficulty||'B')
    setSourceText(d.source?.text||'')
    setTags((d.tags||[]).join(', '))
    setLargeCategoryId(d.largeCategoryId||null)
    setMediumCategoryId(d.mediumCategoryId||null)
    setSmallCategoryId(d.smallCategoryId||null)
  }

  useEffect(()=>{ load() },[id])

  const onCatChange = (e)=>{
    if(e.level==='L'){ setLargeCategoryId(e.id||null); setMediumCategoryId(null); setSmallCategoryId(null) }
    if(e.level==='M'){ setMediumCategoryId(e.id||null); setSmallCategoryId(null) }
    if(e.level==='S'){ setSmallCategoryId(e.id||null) }
  }

  const checkDuplicate = async ()=>{
    const q = query(collection(db,'materials'), where('type','==',type), where('text','==', text.trim()))
    const snap = await getDocs(q)
    if(!isNew){
      // 수정 중인 문서는 제외
      const exist = snap.docs.find(d=>d.id!==id)
      return !!exist
    }
    return snap.size>0
  }

  const save = async ()=>{
    if(!text.trim()) { alert('영문 텍스트를 입력하세요.'); return }
    if(await checkDuplicate()){ alert('같은 타입의 동일 텍스트가 이미 존재합니다.'); return }

    const payload = {
      type, text: text.trim(),
      translationKo: translationKo.trim(),
      difficulty,
      source: { text: sourceText.trim()||null },
      largeCategoryId: largeCategoryId||null,
      mediumCategoryId: mediumCategoryId||null,
      smallCategoryId: smallCategoryId||null,
      tags: tags.split(',').map(s=>s.trim()).filter(Boolean),
      updatedAt: serverTimestamp(),
    }

    if(isNew){
      await addDoc(collection(db,'materials'), {
        ...payload,
        createdAt: serverTimestamp()
      })
    }else{
      await updateDoc(doc(db,'materials', id), payload)
    }
    nav('/materials')
  }

  return (
    <>
      <div className="card">
        <h2 className="title">{isNew?'새 항목 추가':'항목 수정'}</h2>
        <div className="row">
          <div className="col">
            <label>타입</label>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="sentence">문장</option>
              <option value="passage">지문</option>
            </select>
          </div>
          <div className="col">
            <label>난이도</label>
            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              <option value="A">A(쉬움)</option>
              <option value="B">B(중간)</option>
              <option value="C">C(어려움)</option>
            </select>
          </div>
          <div className="col">
            <label>출처(자유입력)</label>
            <input value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="예) 2023 고3 9월 모평 22번" />
          </div>
          <div className="col">
            <label>태그(쉼표 구분)</label>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="예) 도치, 관계사절" />
          </div>
        </div>

        <CategoryPicker
          largeCategoryId={largeCategoryId}
          mediumCategoryId={mediumCategoryId}
          smallCategoryId={smallCategoryId}
          onChange={onCatChange}
        />

        <div className="row">
          <div className="col">
            <label>영문 텍스트</label>
            <textarea rows={type==='sentence'?4:10} value={text} onChange={e=>setText(e.target.value)} />
          </div>
          <div className="col">
            <label>한국어 해석</label>
            <textarea rows={type==='sentence'?4:10} value={translationKo} onChange={e=>setTranslationKo(e.target.value)} />
          </div>
        </div>

        <div className="toolbar" style={{marginTop:12}}>
          <button onClick={save}>{isNew?'등록':'저장'}</button>
          <button className="secondary" onClick={()=>history.back()}>취소</button>
        </div>
      </div>
    </>
  )
}
