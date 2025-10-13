// src/pages/CategoryMaterials.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, limit, startAfter
} from 'firebase/firestore';
import { db } from '../firebase';
import CategoryPicker from '../components/CategoryPicker';
import { useSearchParams } from 'react-router-dom';

// URL <-> state 변환 유틸
function parseParams(sp) {
  const type = sp.get('type') || 'sentence';
  const largeId = sp.get('L') || null;
  const mediumId = sp.get('M') || null;
  const smallId = sp.get('S') || null;
  const q = sp.get('q') || '';
  return {
    type,
    path: { largeId, mediumId, smallId },
    qText: q,
  };
}
function buildParams({ type, path, qText }) {
  const p = new URLSearchParams();
  if (type) p.set('type', type);
  if (path?.largeId) p.set('L', path.largeId);
  if (path?.mediumId) p.set('M', path.mediumId);
  if (path?.smallId) p.set('S', path.smallId);
  if (qText?.trim()) p.set('q', qText.trim());
  return p;
}
function paramsToString(sp) {
  // 정렬된 문자열로 비교 (루프 방지)
  return [...sp.entries()].sort((a,b)=> a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join('&');
}

export default function CategoryMaterials() {
  const [searchParams, setSearchParams] = useSearchParams();
  const applyingRef = useRef(false); // 우리 쪽에서 setSearchParams 했는지 여부
  const lastAppliedRef = useRef(paramsToString(searchParams));

  // 필터 상태
  const [type, setType] = useState('sentence'); // 기본: 문장
  const [path, setPath] = useState({ largeId:null, mediumId:null, smallId:null });
  const [qText, setQText] = useState('');

  // 결과
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // --- URL -> state (처음 로드 + 뒤/앞 탐색 반영) ---
  useEffect(() => {
    const cur = paramsToString(searchParams);
    if (cur === lastAppliedRef.current && applyingRef.current) {
      // 방금 우리가 쓴 것: 플래그만 해제
      applyingRef.current = false;
      return;
    }
    // 브라우저 내비게이션 혹은 최초 진입: URL 값을 state에 반영
    const { type: t, path: p, qText: q } = parseParams(searchParams);
    setType(t);
    setPath(p);
    setQText(q);
    lastAppliedRef.current = cur;
    applyingRef.current = false;
  }, [searchParams]);

  // --- state -> URL (사용자 조작 반영) ---
  useEffect(() => {
    const next = buildParams({ type, path, qText });
    const nextStr = paramsToString(next);
    if (nextStr !== lastAppliedRef.current) {
      applyingRef.current = true;
      setSearchParams(next, { replace: true });
      lastAppliedRef.current = nextStr;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, path.largeId, path.mediumId, path.smallId, qText]);

  // 쿼리 빌드용: 가장 깊은 선택을 우선
  const categoryClause = useMemo(() => {
    if (path.smallId)  return { field: 'smallIds',  value: path.smallId };
    if (path.mediumId) return { field: 'mediumIds', value: path.mediumId };
    if (path.largeId)  return { field: 'largeIds',  value: path.largeId };
    return null;
  }, [path]);

  const buildQuery = (cursor=null) => {
    const clauses = [];
    if (type) clauses.push(where('type','==', type));
    if (categoryClause) clauses.push(where(categoryClause.field, 'array-contains', categoryClause.value));
    // 최신순 정렬
    let qRef = query(collection(db, 'materials'), ...clauses, orderBy('createdAt','desc'), limit(50));
    if (cursor) qRef = query(collection(db, 'materials'), ...clauses, orderBy('createdAt','desc'), startAfter(cursor), limit(50));
    return qRef;
  };

  const load = async (isMore=false) => {
    setLoading(true);
    const qRef = buildQuery(isMore ? nextCursor : null);
    const snap = await getDocs(qRef);
    const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const filtered = qText.trim()
      ? docs.filter(it => {
          const s = qText.trim().toLowerCase();
          return (it.text||'').toLowerCase().includes(s)
              || (it.translationKo||'').toLowerCase().includes(s)
              || (it.source?.text||'').toLowerCase().includes(s);
        })
      : docs;

    if (isMore) {
      setItems(prev => [...prev, ...filtered]);
    } else {
      setItems(filtered);
    }

    // 페이지네이션 커서
    const lastDoc = snap.docs[snap.docs.length - 1] || null;
    setNextCursor(lastDoc);
    setHasMore(!!lastDoc);
    setLoading(false);
  };

  // 필터 변경 시 재조회 (type/분류 변경 → 자동 조회)
  useEffect(() => { 
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categoryClause?.field, categoryClause?.value]);

  return (
    <>
      <div className="card">
        <h2 className="title">분류별 목록</h2>
        <div className="row" style={{ alignItems:'flex-end' }}>
          <div className="col">
            <label>타입</label>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="sentence">문장</option>
              <option value="passage">지문</option>
            </select>
          </div>
          <div className="col" style={{flex:2}}>
            <label>분류 선택</label>
            <CategoryPicker
              largeCategoryId={path.largeId}
              mediumCategoryId={path.mediumId}
              smallCategoryId={path.smallId}
              onChange={({level, id})=>{
                if(level==='L') setPath({ largeId:id, mediumId:null, smallId:null });
                if(level==='M') setPath(prev=>({ ...prev, mediumId:id, smallId:null }));
                if(level==='S') setPath(prev=>({ ...prev, smallId:id }));
              }}
            />
          </div>
          <div className="col" style={{flex:2}}>
            <label>검색(영문/해석/출처)</label>
            <input
              value={qText}
              onChange={e=>setQText(e.target.value)}
              placeholder="예) 도치 / 관계사 / 모평 22번"
            />
          </div>
          <div className="col">
            <button className="secondary" onClick={()=>load(false)} disabled={loading}>
              {loading ? '검색중…' : '필터 적용'}
            </button>
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
              <th style={{width:160}}>출처</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id}>
                <td><span className="badge">{it.type}</span></td>
                <td style={{maxWidth:520, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.text}>{it.text}</td>
                <td style={{maxWidth:420, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.translationKo}>{it.translationKo}</td>
                <td>{it.source?.text || '-'}</td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={4} style={{textAlign:'center', color:'#777'}}>데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>

        <div className="toolbar" style={{marginTop:12}}>
          <button onClick={()=>load(false)} className="secondary">새로고침</button>
          <button onClick={()=>load(true)} disabled={!hasMore || loading}>{hasMore ? '더 보기' : '더 없음'}</button>
        </div>
      </div>
    </>
  );
}
