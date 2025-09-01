import {
  addDoc, collection, deleteDoc, doc, getCountFromServer,
  getDocs, orderBy, query, updateDoc, where, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect, useMemo, useState } from 'react'

// MUI
import {
  Accordion, AccordionSummary, AccordionDetails,
  Box, Button, IconButton, Stack, TextField, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

// DnD
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

/* ---------------------- 유틸 ---------------------- */
async function isCategoryInUse(catId, level){
  const field =
    level === 'L' ? 'largeCategoryId' :
    level === 'M' ? 'mediumCategoryId' : 'smallCategoryId'
  const cnt = await getCountFromServer(
    query(collection(db,'materials'), where(field,'==',catId))
  )
  return cnt.data().count > 0
}

function normalizeOrder(arr){
  // 0,10,20… 로 재부여 (중간 삽입 여유)
  return arr.map((x,i)=>({ ...x, order: i*10 }))
}

async function loadAll(){
  const snap = await getDocs(query(
    collection(db,'categories'),
    orderBy('level','asc'), orderBy('parentId','asc'), orderBy('order','asc')
  ))
  const all = snap.docs.map(d=>({id:d.id, ...d.data()}))
  const Ls = all.filter(x=>x.level==='L')
  const Ms = all.filter(x=>x.level==='M')
  const Ss = all.filter(x=>x.level==='S')

  const MbyParent = Ms.reduce((m,x)=>{ (m[x.parentId] ||= []).push(x); return m }, {})
  const SbyParent = Ss.reduce((m,x)=>{ (m[x.parentId] ||= []).push(x); return m }, {})

  const tree = Ls.map(L=>({
    ...L,
    children: (MbyParent[L.id]||[]).map(M=>({
      ...M,
      children: (SbyParent[M.id]||[])
    }))
  }))

  return tree
}

/* ---------------------- 컴포넌트 ---------------------- */
export default function Categories(){
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)

  // 신규 입력
  const [newL, setNewL] = useState({ name:'', order:0 })
  const [newM, setNewM] = useState({}) // key: L.id -> {name, order}
  const [newS, setNewS] = useState({}) // key: M.id -> {name, order}

  // 편집
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ name:'', order:0 })

  const reload = async ()=>{
    setLoading(true)
    const t = await loadAll()
    setTree(t)
    setLoading(false)
  }
  useEffect(()=>{ reload() },[])

  const startEdit = (cat)=>{
    setEditingId(cat.id)
    setEditDraft({ name: cat.name||'', order: cat.order||0 })
  }
  const cancelEdit = ()=> setEditingId(null)

  const saveEdit = async ()=>{
    if(!editingId) return
    await updateDoc(doc(db,'categories', editingId), {
      name: editDraft.name.trim(),
      order: Number(editDraft.order)||0
    })
    setEditingId(null)
    await reload()
  }

  const addL = async ()=>{
    if(!newL.name.trim()) return
    await addDoc(collection(db,'categories'), {
      name: newL.name.trim(),
      level: 'L',
      parentId: null,
      order: Number(newL.order)||0,
      createdAt: new Date()
    })
    setNewL({ name:'', order:0 })
    await reload()
  }
  const addM = async (Lid)=>{
    const draft = newM[Lid] || {name:'', order:0}
    if(!draft.name?.trim()) return
    await addDoc(collection(db,'categories'), {
      name: draft.name.trim(),
      level: 'M',
      parentId: Lid,
      order: Number(draft.order)||0,
      createdAt: new Date()
    })
    setNewM(prev=>({...prev, [Lid]: {name:'', order:0}}))
    await reload()
  }
  const addS = async (Mid)=>{
    const draft = newS[Mid] || {name:'', order:0}
    if(!draft.name?.trim()) return
    await addDoc(collection(db,'categories'), {
      name: draft.name.trim(),
      level: 'S',
      parentId: Mid,
      order: Number(draft.order)||0,
      createdAt: new Date()
    })
    setNewS(prev=>({...prev, [Mid]: {name:'', order:0}}))
    await reload()
  }

  const removeCategory = async (cat)=>{
    if(await isCategoryInUse(cat.id, cat.level)){
      alert('이 분류를 사용하는 항목이 있어 삭제할 수 없습니다.')
      return
    }
    if(!confirm('정말 삭제할까요?')) return
    await deleteDoc(doc(db,'categories', cat.id))
    await reload()
  }

  /* ---------- Drag & Drop ---------- */
  // droppableId 규칙:
  //   L-ROOT : L 레벨 재정렬
  //   M-<Lid>: 해당 L 밑 M 재정렬
  //   S-<Mid>: 해당 M 밑 S 재정렬
  const onDragEnd = async (result)=>{
    const { destination, source, draggableId } = result
    if(!destination) return
    if(destination.droppableId === source.droppableId &&
       destination.index === source.index) return

    const dId = destination.droppableId
    const sId = source.droppableId

    // 같은 리스트 내에서만 허용 (다른 부모로 이동은 이번 버전에선 미허용)
    if(dId !== sId) return

    const batch = writeBatch(db)

    if(sId === 'L-ROOT'){
      const arr = Array.from(tree)
      const [moved] = arr.splice(source.index,1)
      arr.splice(destination.index,0,moved)
      const normalized = normalizeOrder(arr)
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order })
      })
    }

    if(sId.startsWith('M-')){
      const Lid = sId.split('M-')[1]
      const target = tree.find(L=>L.id===Lid)
      if(!target) return
      const arr = Array.from(target.children||[])
      const [moved] = arr.splice(source.index,1)
      arr.splice(destination.index,0,moved)
      const normalized = normalizeOrder(arr)
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order })
      })
    }

    if(sId.startsWith('S-')){
      const Mid = sId.split('S-')[1]
      const L = tree.find(L=> (L.children||[]).some(M=>M.id===Mid))
      const targetM = L?.children?.find(M=>M.id===Mid)
      if(!targetM) return
      const arr = Array.from(targetM.children||[])
      const [moved] = arr.splice(source.index,1)
      arr.splice(destination.index,0,moved)
      const normalized = normalizeOrder(arr)
      normalized.forEach(c=>{
        batch.update(doc(db,'categories', c.id), { order: c.order })
      })
    }

    await batch.commit()
    await reload()
  }

  /* ---------- 렌더 ---------- */
  return (
    <Box className="container">
      <Box className="card">
        <Typography className="title" variant="h5">분류 관리 (MUI + 드래그 정렬)</Typography>
        <Typography variant="body2">대분류를 만들면 바로 아래에서 그 <b>중분류</b>를, 중분류를 만들면 바로 아래에서 그 <b>소분류</b>를 추가할 수 있습니다. 행 왼쪽의 <DragIndicatorIcon fontSize="inherit" /> 아이콘을 잡고 드래그하면 순서가 저장됩니다.</Typography>
      </Box>

      {/* 대분류 추가 */}
      <Box className="card">
        <Typography className="title" variant="h6">대분류 추가</Typography>
        <Stack direction="row" spacing={2}>
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
          {/* L 드래그 가능한 루트 리스트 */}
          <Droppable droppableId="L-ROOT" type="L">
            {(provided)=>(
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {tree.map((L, li)=>(
                  <Draggable draggableId={`L-${L.id}`} index={li} key={L.id}>
                    {(p)=>(
                      <div ref={p.innerRef} {...p.draggableProps}>
                        <Accordion defaultExpanded sx={{mb:1.5}}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{width:'100%'}}>
                              <Box {...p.dragHandleProps} sx={{pr:1, color:'#666', display:'flex', alignItems:'center'}}><DragIndicatorIcon/></Box>
                              <Typography variant="subtitle1" sx={{flex:1}}>
                                대분류: <b>{L.name}</b> <Chip size="small" label={`order ${L.order ?? 0}`} sx={{ml:1}} />
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <IconButton size="small" onClick={()=>startEdit(L)}><EditIcon/></IconButton>
                                <IconButton size="small" color="error" onClick={()=>removeCategory(L)}><DeleteIcon/></IconButton>
                              </Stack>
                            </Stack>
                          </AccordionSummary>

                          <AccordionDetails>
                            {/* L 인라인 수정 */}
                            {editingId===L.id && (
                              <Box sx={{mb:2}}>
                                <Stack direction="row" spacing={2}>
                                  <TextField label="이름" value={editDraft.name} onChange={e=>setEditDraft(d=>({...d, name:e.target.value}))} fullWidth />
                                  <TextField label="order" type="number" value={editDraft.order} onChange={e=>setEditDraft(d=>({...d, order:e.target.value}))} sx={{width:160}} />
                                  <Button variant="contained" startIcon={<SaveIcon/>} onClick={saveEdit}>저장</Button>
                                  <Button variant="outlined" startIcon={<CloseIcon/>} onClick={cancelEdit}>취소</Button>
                                </Stack>
                                <Divider sx={{mt:2}}/>
                              </Box>
                            )}

                            {/* 중분류 테이블 + 드래그 */}
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
                                          <TableRow ref={mp.innerRef} {...mp.draggableProps}>
                                            <TableCell {...mp.dragHandleProps} sx={{color:'#666'}}><DragIndicatorIcon fontSize="small"/></TableCell>
                                            <TableCell>{M.name}</TableCell>
                                            <TableCell>{M.order ?? 0}</TableCell>
                                            <TableCell>
                                              <IconButton size="small" onClick={()=>startEdit(M)}><EditIcon/></IconButton>
                                              <IconButton size="small" color="error" onClick={()=>removeCategory(M)}><DeleteIcon/></IconButton>
                                            </TableCell>
                                          </TableRow>
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

                            {/* 각 중분류 아래 소분류 아코디언 */}
                            {(L.children||[]).map(M=>(
                              <Accordion key={M.id} sx={{mb:1, bgcolor:'#f8fbff'}}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                  <Stack direction="row" spacing={1} alignItems="center" sx={{width:'100%'}}>
                                    <Typography variant="body1" sx={{flex:1}}>소분류 (상위: {M.name})</Typography>
                                  </Stack>
                                </AccordionSummary>
                                <AccordionDetails>
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
                                </AccordionDetails>
                              </Accordion>
                            ))}
                          </AccordionDetails>
                        </Accordion>
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
  )
}
