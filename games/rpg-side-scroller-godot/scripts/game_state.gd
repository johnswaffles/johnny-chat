extends Node

var max_hp := 100
var hp := 100
var attack := 18
var defense := 1
var coins := 0
var keys := 0
var weapon_tier := 1
var follower_rescued := false
var boss_max_hp := 160
var boss_hp := 160
var level_complete := false

func reset_run() -> void:
	max_hp = 100
	hp = max_hp
	attack = 18
	defense = 1
	coins = 0
	keys = 0
	weapon_tier = 1
	follower_rescued = false
	boss_max_hp = 160
	boss_hp = boss_max_hp
	level_complete = false

func add_coins(amount: int) -> void:
	coins += amount

func add_key() -> void:
	keys += 1

func upgrade_weapon() -> bool:
	if weapon_tier >= 2 or coins < 35:
		return false
	coins -= 35
	weapon_tier = 2
	attack = 30
	return true
