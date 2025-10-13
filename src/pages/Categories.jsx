// src/pages/Categories.jsx
import {
  addDoc, collection, deleteDoc, doc, getDocs, getCountFromServer,
  orderBy, query, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect, useMemo, useState } from 'react';

// MUI
import {
  Box, Button, IconButton, Stack, TextField, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider, Paper, Collapse
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// DnD
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

/* ---------------------- 유틸 ---------------------- */
async function isCategoryInUse(catId, level){
  const field =
    level === 'L' ? 'largeIds' :
    level === 'M' ? 'mediumIds' : 'smallIds';
  // 재사용 여부(materials)
  const cnt = await getCountFromServer(
    query(collection(db,'materials'), where(field,'array-contains',catId))
  );
  return cnt.data().count > 0;
}

async function hasChildren(cat){
  if(cat.level === 'L'){
    const qs = await getDocs(query(
      collection(db,'categories'),
      where('level','==','M'), where('parentId','==', cat.id)
    ));
    return qs.size > 0;
  }
  if(cat.level === 'M'){
    const qs = await getDocs(query(
      collection(db,'categories'),
      where('level','==','S'), where('parentId','==', cat.id)
    ));
    return qs.size > 0;
  }
  return false;
}

function normalizeOrder(arr){
  // 0,100,200… 로 재부여 (여유 크게)
  return arr.map((x,i)=>({ ...x, order: i*100 }));
}

async function loadAll(){
  const snap = await getDocs(query(
    collection(db,'categories'),
    orderBy('level','asc'), orderBy('parentId','asc'), orderBy('order','asc')
  ));
  const all = snap.docs.map(d=>({id:d.id, ...d.data()}));
  const Ls = all.filter(x=>x.level==='L');
  const Ms = all.filter(x=>x.level==='M');
  const Ss = all.filter(x=>x.level==='S');

  const MbyParent = Ms.reduce((m,x)=>{ (m[x.parentId] ||= []).push(x); return m }, {});
  const SbyParent = Ss.reduce((m,x)=>{ (m[x.parentId] ||= []).push(x); return m }, {});

  const tree = Ls.map(L=>({
    ...L,
    children: (MbyParent[L.id]||[]).map(M=>({
      ...M,
      children: (SbyParent[M.id]||[])
    }))
  }));

  return tree;
}

/* ---------------------- 컴포넌트 ---------------------- */
export default function CategoriesInline(){
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // 신규 입력
  const [newL, setNewL] = useState({ name:'', order:0 });
  const [newM, setNewM] = useState({}); // key: L.id -> {name, order}
  const [newS, setNewS] = useState({}); // key: M.id -> {name, order}

  // 편집
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name:'', order:0 });

  // 소분류 표시 토글 (중분류별)
  const [openS, setOpenS] = useState({}); // key: M.id -> boolean

  const reload = async ()=>{
    setLoading(true);
    const t = await loadAll();
    setTree(t);
    setLoading(false);
  };
  useEffect(()=>{ reload(); },[]);

  const startEdit = (cat)=>{
    setEditingId(cat.id);
    setEditDraft({ name: cat.name||'', order: cat.order ?? 0 });
  };
  const cancelEdit = ()=> setEditingId(null);
  const saveEdit = async ()=>{
    if(!editingId) return;
    await updateDoc(doc(db,'categories', editingId), {
      name: (editDraft.name||'').trim(),
      order: Number(editDraft.order)||0
    });
    setEditingId(null);
    await reload();
  };

  const addL = async ()=>{
    if(!newL.name.trim()) return;
    await addDoc(collection(db,'categories'), {
      name: newL.name.trim(),
      level: 'L',
      parentId: null,
      order: Number(newL.order)||0,
      createdAt: new Date()
    });
    setNewL({ name:'', order:0 });
    await reload();
  };
  const addM = async (Lid)=>{
    const draft = newM[Lid] || {name:'', order:0};
    if(!draft.name?.trim()) return;
    await addDoc(collection(db,'categories'), {
      name: draft.name.trim(),
      level: 'M',
      parentId: Lid,
      order: Number(draft.order)||0,
      createdAt: new Date()
    });
    setNewM(prev=>({...prev, [Lid]: {name:'', order:0}}));
    await reload();
  };
  const addS = async (Mid)=>{
    const draft = newS[Mid] || {name:'', order:0};
    if(!draft.name?.trim()) return;
    await addDoc(collection(db,'categories'), {
      name: draft.name.trim(),
      level: 'S',
      parentId: Mid,
      order: Number(draft.order)||0,
      createdAt: new Date()
    });
    setNewS(prev=>({...prev, [Mid]: {name:'', order:0}}));
    await reload();
  };

  const removeCategory = async (cat)=>{
    if(await hasChildren(cat)){
      alert('하위 분류가 있어 삭제할 수 없습니다.');
      return;
    }
    if(await isCategoryInUse(cat.id, cat.level)){
      alert('이 분류를 사용하는 항목이 있어 삭제할 수 없습니다.');
      return;
    }
    if(!confirm('정말 삭제할까요?')) return;
    await deleteDoc(doc(db,'categories', cat.id));
    await reload();
  };

  /* ---------- Drag & Drop ---------- */
  // droppableId 규칙:
  //   L-ROOT : L 레벨 재정렬
  //   M-<Lid>: 해당 L 밑 M 재정렬
  //   S-<Mid>: 해당 M 밑 S 재정렬
  const onDragEnd = async (result)=>{
    const { destination, source } = result;
    if(!destination) return;
    if(destination.droppableId === source.droppableId &&
       destination.index === source.index) return;

    const dId = destination.droppableId;
    const sId = source.droppableId;
    if(dId !== sId) return; // 부모 이동은 이번 버전 미허용

    const batch = writeBatch(db);

    if(sId === 'L-ROOT'){
      const arr = Array.from(tree);
      const [moved] = arr.splice(source.index,1);
      arr.splice(destination.index,0,moved);
      const normalized = normalizeOrder(arr);
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order });
      });
    }

    if(sId.startsWith('M-')){
      const Lid = sId.split('M-')[1];
      const L = tree.find(x=>x.id===Lid);
      if(!L) return;
      const arr = Array.from(L.children||[]);
      const [moved] = arr.splice(source.index,1);
      arr.splice(destination.index,0,moved);
      const normalized = normalizeOrder(arr);
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order });
      });
    }

    if(sId.startsWith('S-')){
      const Mid = sId.split('S-')[1];
      // 해당 M 찾기
      let targetM = null;
      for(const L of tree){
        targetM = (L.children||[]).find(m=>m.id===Mid);
        if(targetM) break;
      }
      if(!targetM) return;
      const arr = Array.from(targetM.children||[]);
      const [moved] = arr.splice(source.index,1);
      arr.splice(destination.index,0,moved);
      const normalized = normalizeOrder(arr);
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order });
      });
    }

    await batch.commit();
    await reload();
  };

  /* ---------- 렌더 ---------- */
  return (
    <Box className="container">
      <Box className="card">
        <Typography className="title" variant="h5">분류 관리 (대분류 바로 밑에서 중분류 · 중분류 바로 밑에서 소분류 관리)</Typography>
        <Typography variant="body2">
          각 <b>대분류 카드 안에서 중분류</b>를 바로 관리하고, 각 <b>중분류 행 바로 아래에서 소분류</b>를 관리합니다.
          왼쪽의 <DragIndicatorIcon fontSize="inherit" /> 아이콘으로 순서 변경 후 자동 저장됩니다.
        </Typography>
      </Box>

      {/* 대분류 추가 */}
      <Box className="card">
        <Typography className="title" variant="h6">대분류 추가</Typography>
        <Stack direction={{xs:'column', sm:'row'}} spacing={2}>
          <TextField
            label="이름"
            value={newL.name}
            onChange={e=>setNewL(s=>({...s, name:e.target.value}))}
            fullWidth
          />
          <TextField
            label="정렬 order"
            type="number"
            value={newL.order}
            onChange={e=>setNewL(s=>({...s, order:e.target.value}))}
            sx={{width:160}}
          />
          <Button variant="contained" startIcon={<AddIcon/>} onClick={addL}>대분류 추가</Button>
        </Stack>
      </Box>

      {loading && <Box className="card">불러오는 중…</Box>}

      {!loading && (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* L 루트 드래그 */}
          <Droppable droppableId="L-ROOT" type="L">
            {(provided)=>(
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {tree.map((L, li)=>(
                  <Draggable draggableId={`L-${L.id}`} index={li} key={L.id}>
                    {(p)=>(
                      <div ref={p.innerRef} {...p.draggableProps} style={{marginBottom:16}}>
                        <Paper elevation={1} sx={{p:2}}>
                          {/* L 헤더 */}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{width:'100%', mb:1}}>
                            <Box {...p.dragHandleProps} sx={{pr:1, color:'#666', display:'flex', alignItems:'center'}}><DragIndicatorIcon/></Box>
                            <Typography variant="subtitle1" sx={{flex:1}}>
                              대분류: <b>{L.name}</b> <Chip size="small" label={`order ${L.order ?? 0}`} sx={{ml:1}} />
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <IconButton size="small" onClick={()=>startEdit(L)}><EditIcon/></IconButton>
                              <IconButton size="small" color="error" onClick={()=>removeCategory(L)}><DeleteIcon/></IconButton>
                            </Stack>
                          </Stack>

                          {/* L 인라인 수정 */}
                          {editingId===L.id && (
                            <Box sx={{mb:2}}>
                              <Stack direction={{xs:'column', sm:'row'}} spacing={2}>
                                <TextField label="이름" value={editDraft.name} onChange={e=>setEditDraft(d=>({...d, name:e.target.value}))} fullWidth />
                                <TextField label="order" type="number" value={editDraft.order} onChange={e=>setEditDraft(d=>({...d, order:e.target.value}))} sx={{width:160}} />
                                <Button variant="contained" startIcon={<SaveIcon/>} onClick={saveEdit}>저장</Button>
                                <Button variant="outlined" startIcon={<CloseIcon/>} onClick={cancelEdit}>취소</Button>
                              </Stack>
                              <Divider sx={{mt:2}}/>
                            </Box>
                          )}

                          {/* 중분류 테이블 (같은 카드 안에서 바로 관리) */}
                          <Typography variant="subtitle2" sx={{mb:1}}>중분류</Typography>
                          <Droppable droppableId={`M-${L.id}`} type="M">
                            {(mProvided)=>(
                              <Table ref={mProvided.innerRef} {...mProvided.droppableProps} size="small" sx={{mb:2}}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell width={40}></TableCell>
                                    <TableCell>이름</TableCell>
                                    <TableCell width={120}>order</TableCell>
                                    <TableCell width={180}>작업</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(L.children||[]).map((M, mi)=>(
                                    <Draggable draggableId={`M-${M.id}`} index={mi} key={M.id}>
                                      {(mp)=>(
                                        <>
                                          <TableRow ref={mp.innerRef} {...mp.draggableProps}>
                                            <TableCell {...mp.dragHandleProps} sx={{color:'#666'}}><DragIndicatorIcon fontSize="small"/></TableCell>
                                            <TableCell>
                                              <Stack direction="row" alignItems="center" spacing={1}>
                                                <IconButton
                                                  size="small"
                                                  onClick={()=>setOpenS(prev=>({...prev, [M.id]: !prev[M.id]}))}
                                                  title="소분류 펼치기/닫기"
                                                >
                                                  {openS[M.id] ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                                                </IconButton>
                                                <b>{M.name}</b>
                                                <Chip size="small" label={`M`} />
                                              </Stack>
                                            </TableCell>
                                            <TableCell>{M.order ?? 0}</TableCell>
                                            <TableCell>
                                              <IconButton size="small" onClick={()=>startEdit(M)}><EditIcon/></IconButton>
                                              <IconButton size="small" color="error" onClick={()=>removeCategory(M)}><DeleteIcon/></IconButton>
                                            </TableCell>
                                          </TableRow>

                                          {/* M 인라인 수정 */}
                                          {editingId===M.id && (
                                            <TableRow>
                                              <TableCell />
                                              <TableCell colSpan={3}>
                                                <Stack direction={{xs:'column', sm:'row'}} spacing={2} sx={{py:1}}>
                                                  <TextField label="이름" value={editDraft.name} onChange={e=>setEditDraft(d=>({...d, name:e.target.value}))} fullWidth />
                                                  <TextField label="order" type="number" value={editDraft.order} onChange={e=>setEditDraft(d=>({...d, order:e.target.value}))} sx={{width:160}} />
                                                  <Button variant="contained" startIcon={<SaveIcon/>} onClick={saveEdit}>저장</Button>
                                                  <Button variant="outlined" startIcon={<CloseIcon/>} onClick={cancelEdit}>취소</Button>
                                                </Stack>
                                              </TableCell>
                                            </TableRow>
                                          )}

                                          {/* 소분류: 중분류 바로 밑에서 관리 */}
                                          <TableRow>
                                            <TableCell />
                                            <TableCell colSpan={3} sx={{p:0, border:0}}>
                                              <Collapse in={!!openS[M.id]} timeout="auto" unmountOnExit>
                                                <Paper variant="outlined" sx={{m:1, p:1.5, bgcolor:'#f8fbff'}}>
                                                  <Typography variant="body2" sx={{mb:1}}>소분류 (상위: {M.name})</Typography>
                                                  <Droppable droppableId={`S-${M.id}`} type="S">
                                                    {(sProvided)=>(
                                                      <Table ref={sProvided.innerRef} {...sProvided.droppableProps} size="small">
                                                        <TableHead>
                                                          <TableRow>
                                                            <TableCell width={40}></TableCell>
                                                            <TableCell>이름</TableCell>
                                                            <TableCell width={120}>order</TableCell>
                                                            <TableCell width={180}>작업</TableCell>
                                                          </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                          {(M.children||[]).map((S, si)=>(
                                                            <Draggable draggableId={`S-${S.id}`} index={si} key={S.id}>
                                                              {(sp)=>(
                                                                <TableRow ref={sp.innerRef} {...sp.draggableProps}>
                                                                  <TableCell {...sp.dragHandleProps} sx={{color:'#666'}}><DragIndicatorIcon fontSize="small"/></TableCell>
                                                                  <TableCell>{S.name}</TableCell>
                                                                  <TableCell>{S.order ?? 0}</TableCell>
                                                                  <TableCell>
                                                                    <IconButton size="small" onClick={()=>startEdit(S)}><EditIcon/></IconButton>
                                                                    <IconButton size="small" color="error" onClick={()=>removeCategory(S)}><DeleteIcon/></IconButton>
                                                                  </TableCell>
                                                                </TableRow>
                                                              )}
                                                            </Draggable>
                                                          ))}
                                                          {sProvided.placeholder}
                                                          {/* S 추가행 */}
                                                          <TableRow>
                                                            <TableCell />
                                                            <TableCell>
                                                              <TextField size="small" placeholder="소분류 이름"
                                                                value={(newS[M.id]?.name)||''}
                                                                onChange={e=>setNewS(prev=>({...prev, [M.id]: { ...(prev[M.id]||{order:0}), name:e.target.value}}))}
                                                                fullWidth
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              <TextField size="small" type="number"
                                                                value={(newS[M.id]?.order)||0}
                                                                onChange={e=>setNewS(prev=>({...prev, [M.id]: { ...(prev[M.id]||{name:''}), order:e.target.value}}))}
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              <Button size="small" variant="contained" startIcon={<AddIcon/>} onClick={()=>addS(M.id)}>소분류 추가</Button>
                                                            </TableCell>
                                                          </TableRow>
                                                        </TableBody>
                                                      </Table>
                                                    )}
                                                  </Droppable>
                                                </Paper>
                                              </Collapse>
                                            </TableCell>
                                          </TableRow>
                                        </>
                                      )}
                                    </Draggable>
                                  ))}
                                  {mProvided.placeholder}
                                  {/* M 추가행 */}
                                  <TableRow>
                                    <TableCell />
                                    <TableCell>
                                      <TextField size="small" placeholder="중분류 이름"
                                        value={(newM[L.id]?.name)||''}
                                        onChange={e=>setNewM(prev=>({...prev, [L.id]: { ...(prev[L.id]||{order:0}), name:e.target.value}}))}
                                        fullWidth
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TextField size="small" type="number"
                                        value={(newM[L.id]?.order)||0}
                                        onChange={e=>setNewM(prev=>({...prev, [L.id]: { ...(prev[L.id]||{name:''}), order:e.target.value}}))}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button size="small" variant="contained" startIcon={<AddIcon/>} onClick={()=>addM(L.id)}>중분류 추가</Button>
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            )}
                          </Droppable>
                        </Paper>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {!loading && !tree.length && (
        <Box className="card" sx={{color:'#777'}}>아직 대분류가 없습니다. 위에서 먼저 대분류를 추가해 주세요.</Box>
      )}
    </Box>
  );
}
