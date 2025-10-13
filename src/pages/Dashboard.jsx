// src/pages/Dashboard.jsx
import { Link } from 'react-router-dom'

export default function Dashboard(){
  return (
    <>
      <div className="card">
        <h2 className="title">대시보드</h2>
        <div className="row">
          {/* 문장/지문 관리 */}
          <div className="col">
            <div className="card">
              <h3 className="title" style={{fontSize:18}}>문장/지문 관리</h3>
              <p>고1~고3 모의고사 기출 문장/지문을 등록하고, 난이도와 대·중·소 분류, 출처, 한국어 해석을 관리합니다.</p>
              <div className="toolbar">
                <Link to="/materials"><button>목록 보기</button></Link>
                <Link to="/materials/new"><button className="secondary">새 항목 추가</button></Link>
              </div>
            </div>
          </div>

          {/* 분류 관리 */}
          <div className="col">
            <div className="card">
              <h3 className="title" style={{fontSize:18}}>분류 관리</h3>
              <p>대·중·소 분류를 직접 추가/수정/삭제하고 정렬 순서를 관리합니다.</p>
              <div className="toolbar">
                <Link to="/categories"><button>분류 관리로 이동</button></Link>
              </div>
            </div>
          </div>

          {/* ✅ 분류별 보기 */}
          <div className="col">
            <div className="card">
              <h3 className="title" style={{fontSize:18}}>분류별 보기</h3>
              <p>선택한 분류(대·중·소)에 속한 문장/지문을 빠르게 조회합니다. (최신순, 페이지네이션 지원)</p>
              <div className="toolbar">
                <Link to="/by-category"><button>열기</button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
