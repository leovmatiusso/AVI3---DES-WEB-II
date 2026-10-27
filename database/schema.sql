CREATE DATABASE IF NOT EXISTS db_vendas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_vendas;

CREATE TABLE IF NOT EXISTS vendedores (
  id_vendedor INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  meta_mensal DECIMAL(12,2) NOT NULL,
  percentual_base DECIMAL(5,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_vendedor),
  CONSTRAINT chk_vendedor_meta CHECK (meta_mensal > 0),
  CONSTRAINT chk_vendedor_percentual CHECK (percentual_base BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS regioes (
  id_regiao TINYINT UNSIGNED NOT NULL,
  nome_regiao VARCHAR(50) NOT NULL,
  percentual_bonus DECIMAL(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_regiao),
  UNIQUE KEY uq_regiao_nome (nome_regiao),
  CONSTRAINT chk_regiao_percentual CHECK (percentual_bonus BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendas (
  id_venda INT UNSIGNED NOT NULL,
  id_vendedor INT UNSIGNED NOT NULL,
  id_regiao TINYINT UNSIGNED NOT NULL,
  data_venda DATETIME NOT NULL,
  valor_venda DECIMAL(12,2) NOT NULL,
  tipo_cliente ENUM('PF', 'PJ') NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_venda),
  CONSTRAINT fk_vendas_vendedor FOREIGN KEY (id_vendedor) REFERENCES vendedores(id_vendedor)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_regiao FOREIGN KEY (id_regiao) REFERENCES regioes(id_regiao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_venda_valor CHECK (valor_venda > 0),
  CONSTRAINT chk_venda_comissao CHECK (valor_comissao >= 0),
  INDEX idx_vendas_data (data_venda),
  INDEX idx_vendas_vendedor_data (id_vendedor, data_venda),
  INDEX idx_vendas_regiao_data (id_regiao, data_venda)
) ENGINE=InnoDB;

INSERT INTO regioes (id_regiao, nome_regiao, percentual_bonus) VALUES
  (1, 'Norte', 1.00),
  (2, 'Nordeste', 1.00),
  (3, 'Sudeste', 0.00),
  (4, 'Sul', 0.50)
ON DUPLICATE KEY UPDATE nome_regiao = VALUES(nome_regiao), percentual_bonus = VALUES(percentual_bonus);

INSERT INTO vendedores (id_vendedor, nome, meta_mensal, percentual_base, ativo) VALUES
  (1, 'Ana Souza', 10000.00, 5.00, TRUE),
  (2, 'Bruno Lima', 12000.00, 4.50, TRUE),
  (3, 'Carla Mendes', 9000.00, 5.50, TRUE),
  (4, 'Diego Alves', 15000.00, 4.00, TRUE),
  (5, 'Eva Martins', 8000.00, 6.00, TRUE)
ON DUPLICATE KEY UPDATE nome = VALUES(nome), meta_mensal = VALUES(meta_mensal), percentual_base = VALUES(percentual_base), ativo = VALUES(ativo);

INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao) VALUES
  (1001, 1, 1, '2026-10-02 10:15:00', 2000.00, 'PJ', 180.00),
  (1002, 1, 2, '2026-10-04 11:20:00', 1800.00, 'PF', 126.00),
  (1003, 1, 3, '2026-10-06 14:00:00', 2500.00, 'PJ', 200.00),
  (1004, 2, 4, '2026-10-03 09:10:00', 3000.00, 'PJ', 270.00),
  (1005, 2, 1, '2026-10-07 16:30:00', 2200.00, 'PF', 176.00),
  (1006, 2, 3, '2026-10-09 12:45:00', 2800.00, 'PJ', 210.00),
  (1007, 3, 2, '2026-10-05 10:00:00', 4000.00, 'PJ', 380.00),
  (1008, 3, 3, '2026-10-11 13:25:00', 3500.00, 'PF', 262.50),
  (1009, 3, 4, '2026-10-13 15:40:00', 2600.00, 'PJ', 234.00),
  (1010, 4, 1, '2026-10-08 08:50:00', 5000.00, 'PJ', 450.00),
  (1011, 4, 2, '2026-10-14 11:35:00', 4500.00, 'PF', 315.00),
  (1012, 4, 3, '2026-10-17 17:05:00', 3000.00, 'PJ', 210.00),
  (1013, 5, 4, '2026-10-10 09:30:00', 2500.00, 'PF', 212.50),
  (1014, 5, 1, '2026-10-19 14:15:00', 3200.00, 'PJ', 320.00),
  (1015, 5, 2, '2026-10-22 10:55:00', 2800.00, 'PF', 252.00)
ON DUPLICATE KEY UPDATE id_venda = VALUES(id_venda);
