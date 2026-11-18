import re
path = "index.html"
s = open(path, encoding="utf-8").read()

old1 = """  hydration_records:{cols:['id','athlete_id','game_id','pre_weight','post_weight','fluids_l','urine_l','duration_h','sweat_rate','weight_loss_pct','notes','registered_by','registered_by_id','updated_at'],
    rename:{athleteId:'athlete_id',gameId:'game_id',preWeight:'pre_weight',postWeight:'post_weight',fluidsL:'fluids_l',urineL:'urine_l',durationH:'duration_h',sweatRate:'sweat_rate',weightLossPct:'weight_loss_pct',registeredBy:'registered_by',registeredById:'registered_by_id',updatedAt:'updated_at'}},"""
new1 = """  hydration_records:{cols:['id','athlete_id','event_id','session_type','pre_weight','post_weight','fluids_l','urine_l','duration_h','sweat_rate','weight_loss_pct','notes','registered_by','registered_by_id','updated_at'],
    rename:{athleteId:'athlete_id',eventId:'event_id',sessionType:'session_type',preWeight:'pre_weight',postWeight:'post_weight',fluidsL:'fluids_l',urineL:'urine_l',durationH:'duration_h',sweatRate:'sweat_rate',weightLossPct:'weight_loss_pct',registeredBy:'registered_by',registeredById:'registered_by_id',updatedAt:'updated_at'}},"""
c1 = s.count(old1)
assert c1 == 1, f"old1 count={c1}"
s = s.replace(old1, new1, 1)

old2 = """      ['hydration_records','hydrationRecords',(d)=>APP.hydrationRecords=d.map(r=>({...r,athleteId:r.athlete_id,gameId:r.game_id,preWeight:r.pre_weight,postWeight:r.post_weight,fluidsL:r.fluids_l,urineL:r.urine_l,durationH:r.duration_h,sweatRate:r.sweat_rate,weightLossPct:r.weight_loss_pct,registeredBy:r.registered_by,registeredById:r.registered_by_id,updatedAt:r.updated_at}))],"""
new2 = """      ['hydration_records','hydrationRecords',(d)=>APP.hydrationRecords=d.map(r=>({...r,athleteId:r.athlete_id,eventId:r.event_id,sessionType:r.session_type,preWeight:r.pre_weight,postWeight:r.post_weight,fluidsL:r.fluids_l,urineL:r.urine_l,durationH:r.duration_h,sweatRate:r.sweat_rate,weightLossPct:r.weight_loss_pct,registeredBy:r.registered_by,registeredById:r.registered_by_id,updatedAt:r.updated_at}))],"""
c2 = s.count(old2)
assert c2 == 1, f"old2 count={c2}"
s = s.replace(old2, new2, 1)

open(path, "w", encoding="utf-8").write(s)
print("SCRIPT_A_OK")
