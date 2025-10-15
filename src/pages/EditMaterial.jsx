// src/pages/EditMaterial.jsx
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MultiCategoryPicker from '../components/MultiCategoryPicker.jsx'

export default function EditMaterial(){
  const nav = useNavigate()
  const { id } = useParams()
  const isNew = !id

  const [type, setType] = useState('sentence')
  const [text, setText] = useState('')
  const [translationKo, setTranslationKo] = useState('')
  const [difficulty, setDifficulty] = useState('B')
  const [sourceText, setSourceText] = useState('')

  // 다중 분류 경로
  const [paths, setPaths] = useState([{ largeId:null, mediumId:null, smallId:null }])

  // 로드
  useEffect(()=>{ (async ()=>{
    if(!id) return
    const snap = await getDoc(doc(db,'materials', id))
    if(!snap.exists()) return
    const d = snap.data()

    setType(d.type||'sentence')
    setText(d.text||'')
    setTranslationKo(d.translationKo||'')
    setDifficulty(d.difficulty||'B')
    setSourceText(d.source?.text||'')

    // 호환: 새 구조(paths)가 있으면 그걸, 없으면 단일 필드로 구성
    if(Array.isArray(d.paths) && d.paths.length){
      setPaths(d.paths.map(p=>({
        largeId: p.largeId ?? p.largeCategoryId ?? null,
        mediumId: p.mediumId ?? p.mediumCategoryId ?? null,
        smallId: p.smallId ?? p.smallCategoryId ?? null,
      })))
    } else {
      setPaths([{
        largeId: d.largeCategoryId ?? null,
        mediumId: d.mediumCategoryId ?? null,
        smallId: d.smallCategoryId ?? null,
      }])
    }
  })() },[id])

  // 중복 체크
  const checkDuplicate = async ()=>{
    const q = query(collection(db,'materials'), where('type','==',type), where('text','==', text.trim()))
    const snap = await getDocs(q)
    if(!isNew){
      const exist = snap.docs.find(d=>d.id!==id)
      return !!exist
    }
    return snap.size>0
  }

  // 저장
  const save = async ()=>{
    if(!text.trim()){ alert('영문 텍스트를 입력하세요.'); return }
    if(await checkDuplicate()){ alert('같은 타입의 동일 텍스트가 이미 존재합니다.'); return }

    // paths 정리
    const cleaned = (paths||[])
      .map(p=>({
        largeId: p.largeId || null,
        mediumId: p.mediumId || null,
        smallId: p.smallId || null
      }))
      // 완전 비어있는 경로는 제거
      .filter(p=>p.largeId || p.mediumId || p.smallId)

    // 쿼리 필터용 배열(중복 제거)
    const uniq = (arr)=> Array.from(new Set(arr.filter(Boolean)))
    const largeIds = uniq(cleaned.map(p=>p.largeId))
    const mediumIds = uniq(cleaned.map(p=>p.mediumId))
    const smallIds = uniq(cleaned.map(p=>p.smallId))

    // 레거시 단일 필드(최초 경로)도 유지하면 기존 코드와 호환 용이
    const legacyFirst = cleaned[0] || {largeId:null, mediumId:null, smallId:null}

    const payload = {
      type,
      text: text.trim(),
      translationKo: translationKo.trim(),
      difficulty,
      source: { text: sourceText.trim() || null },
      // 새 구조
      paths: cleaned,
      largeIds, mediumIds, smallIds,
      // 호환 필드(최초 경로)
      largeCategoryId: legacyFirst.largeId || null,
      mediumCategoryId: legacyFirst.mediumId || null,
      smallCategoryId: legacyFirst.smallId || null,
      updatedAt: serverTimestamp(),
    }

    if(isNew){
      await addDoc(collection(db,'materials'), { ...payload, createdAt: serverTimestamp() })
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
            <input value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="예) 고2-2023-09-29" />
          </div>
          {/* 태그 입력칸 완전 제거됨 */}
        </div>

        {/* 다중 분류 선택 */}
        <div style={{marginTop:8}}>
          <label style={{display:'block', marginBottom:6}}>분류 경로(여러 개 가능)</label>
          <MultiCategoryPicker paths={paths} onChange={setPaths} />
        </div>

        <div className="row" style={{marginTop:8}}>
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
