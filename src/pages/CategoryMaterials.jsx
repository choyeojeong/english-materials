// src/pages/CategoryMaterials.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, limit, startAfter
} from 'firebase/firestore';
import { db } from '../firebase';
import CategoryPicker from '../components/CategoryPicker';
import { useSearchParams } from 'react-router-dom';

function parseParams(sp) {
  const type = sp.get('type') || 'sentence';
  const largeId = sp.get('L') || null;
  const mediumId = sp.get('M') || null;
  const smallId = sp.get('S') || null;
  const difficulty = sp.get('D') || '';
  const q = sp.get('q') || '';
  return { type, difficulty, path: { largeId, mediumId, smallId }, qText: q };
}
function buildParams({ type, difficulty, path, qText }) {
  const p = new URLSearchParams();
  if (type) p.set('type', type);
  if (difficulty) p.set('D', difficulty);
  if (path?.largeId) p.set('L', path.largeId);
  if (path?.mediumId) p.set('M', path.mediumId);
  if (path?.smallId) p.set('S', path.smallId);
  if ((qText || '').trim()) p.set('q', qText.trim());
  return p;
}
function paramsToString(sp) {
  return [...sp.entries()]
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([k,v])=>`${k}=${v}`).join('&');
}

export default function CategoryMaterials() {
  const [searchParams, setSearchParams] = useSearchParams();
  const applyingRef = useRef(false);
  const lastAppliedRef = useRef(paramsToString(searchParams));

  const [type, setType] = useState('sentence');
  const [difficulty, setDifficulty] = useState('');
  const [path, setPath] = useState({ largeId:null, mediumId:null, smallId:null });
  const [qText, setQText] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(qText.trim()), 300);
    return () => clearTimeout(t);
  }, [qText]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // URL → state
  useEffect(() => {
    const cur = paramsToString(searchParams);
    if (cur === lastAppliedRef.current && applyingRef.current) {
      applyingRef.current = false;
      return;
    }
    const { type: t, difficulty: d, path: p, qText: q } = parseParams(searchParams);
    setType(t); setDifficulty(d); setPath(p); setQText(q);
    lastAppliedRef.current = cur;
    applyingRef.current = false;
  }, [searchParams]);

  // state → URL
  useEffect(() => {
    const next = buildParams({ type, difficulty, path, qText });
    const nextStr = paramsToString(next);
    if (nextStr !== lastAppliedRef.current) {
      applyingRef.current = true;
      setSearchParams(next, { replace: true });
      lastAppliedRef.current = nextStr;
    }
  }, [type, difficulty, path.largeId, path.mediumId, path.smallId, qText, setSearchParams]);

  const categoryClause = useMemo(() => {
    if (path.smallId)  return { field: 'smallIds',  value: path.smallId };
    if (path.mediumId) return { field: 'mediumIds', value: path.mediumId };
    if (path.largeId)  return { field: 'largeIds',  value: path.largeId };
    return null;
  }, [path]);

  const legacyFieldOf = (arrayField) =>
    arrayField === 'largeIds' ? 'largeCategoryId'
    : arrayField === 'mediumIds' ? 'mediumCategoryId'
    : 'smallCategoryId';

  const load = async (isMore=false) => {
    setLoading(true);
    try {
      const clausesBase = [];
      if (type) clausesBase.push(where('type','==', type));
      if (difficulty) clausesBase.push(where('difficulty','==', difficulty));

      // 1) 신규 배열 쿼리
      const qMain = (() => {
        if (!categoryClause) {
          return query(
            collection(db, 'materials'),
            ...clausesBase,
            orderBy('createdAt','desc'),
            ...(isMore && nextCursor ? [startAfter(nextCursor)] : []),
            limit(30)
          );
        }
        return query(
          collection(db, 'materials'),
          ...clausesBase,
          where(categoryClause.field, 'array-contains', categoryClause.value),
          orderBy('createdAt','desc'),
          limit(100)
        );
      })();

      // 2) 레거시 단일 필드 쿼리
      const qLegacy = categoryClause ? query(
        collection(db, 'materials'),
        ...clausesBase,
        where(legacyFieldOf(categoryClause.field), '==', categoryClause.value),
        orderBy('createdAt','desc'),
        limit(100)
      ) : null;

      const [snapMain, snapLegacy] = await Promise.all([
        getDocs(qMain),
        qLegacy ? getDocs(qLegacy) : Promise.resolve(null),
      ]);

      const rows = (snap) => (snap ? snap.docs.map(d=>({ id:d.id, ...d.data(), _doc:d })) : []);
      const mergedMap = new Map();
      rows(snapMain).forEach(r => mergedMap.set(r.id, r));
      rows(snapLegacy).forEach(r => mergedMap.set(r.id, r));
      let merged = [...mergedMap.values()];

      // 검색어 필터
      const s = (debouncedQ || '').toLowerCase();
      if (s) {
        merged = merged.filter(it =>
          (it.text||'').toLowerCase().includes(s) ||
          (it.translationKo||'').toLowerCase().includes(s) ||
          (it.source?.text||'').toLowerCase().includes(s)
        );
      }

      merged.sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      const page = merged.slice(0, 30);
      setItems(page);

      if (!categoryClause) {
        const lastDoc = snapMain.docs[snapMain.docs.length - 1] || null;
        setNextCursor(lastDoc);
        setHasMore(!!lastDoc);
      } else {
        setNextCursor(null);
        setHasMore(false);
      }
    } catch (err) {
      console.error('[CategoryMaterials] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [type, difficulty, categoryClause?.field, categoryClause?.value]);
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [debouncedQ]);

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

          <div className="col">
            <label>난이도</label>
            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              <option value="">전체</option>
              <option value="A">A(쉬움)</option>
              <option value="B">B(중간)</option>
              <option value="C">C(어려움)</option>
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
              <th style={{width:100}}>난이도</th>
              <th style={{width:160}}>출처</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id}>
                <td><span className="badge">{it.type}</span></td>
                <td style={{maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.text}>{it.text}</td>
                <td style={{maxWidth:320, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={it.translationKo}>{it.translationKo}</td>
                <td>{it.difficulty||'-'}</td>
                <td>{it.source?.text || '-'}</td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={5} style={{textAlign:'center', color:'#777'}}>데이터가 없습니다.</td></tr>
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
